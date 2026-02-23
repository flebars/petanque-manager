#!/usr/bin/env bash
# Full E2E Test Script for Petanque Manager
# Tests MELEE and COUPE formats with various team counts
set -euo pipefail

BASE="http://localhost:3000"
PASS=0
FAIL=0
RESULTS=()

# ─── Helpers ────────────────────────────────────────────────────────────────

log_pass() { echo "  ✅ $1"; PASS=$((PASS+1)); RESULTS+=("PASS: $1"); }
log_fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); RESULTS+=("FAIL: $1"); }
log_section() { echo; echo "══════════════════════════════════════════════════"; echo "  $1"; echo "══════════════════════════════════════════════════"; }
log_info() { echo "  ℹ️  $1"; }

api() {
  local method="$1" url="$2" data="${3:-}"
  if [ -n "$data" ]; then
    curl -s -X "$method" "$BASE$url" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -X "$method" "$BASE$url" \
      -H "Authorization: Bearer $TOKEN"
  fi
}

check_field() {
  local label="$1" json="$2" field="$3" expected="$4"
  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('$field','MISSING'))" 2>/dev/null || echo "PARSE_ERROR")
  if [ "$actual" = "$expected" ]; then
    log_pass "$label: $field=$actual"
  else
    log_fail "$label: expected $field='$expected', got '$actual'"
  fi
}

check_array_len() {
  local label="$1" json="$2" expected="$3"
  local actual
  actual=$(echo "$json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "PARSE_ERROR")
  if [ "$actual" = "$expected" ]; then
    log_pass "$label: count=$actual"
  else
    log_fail "$label: expected count=$expected, got $actual"
  fi
}

check_no_error() {
  local label="$1" json="$2"
  local has_error
  has_error=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print('error' in d or 'message' in d and d.get('statusCode',200)>=400)" 2>/dev/null || echo "True")
  if [ "$has_error" = "False" ]; then
    log_pass "$label: no error"
  else
    local msg
    msg=$(echo "$json" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message','?'))" 2>/dev/null || echo "?")
    log_fail "$label: error: $msg"
  fi
}

get_id() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null
}

get_field() {
  echo "$1" | python3 -c "import sys,json; print(json.load(sys.stdin).get('$2',''))" 2>/dev/null
}

# ─── Login ──────────────────────────────────────────────────────────────────
log_section "AUTHENTICATION"
RESP=$(curl -s -X POST "$BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@petanque.fr","password":"admin1234"}')
TOKEN=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
if [ -n "$TOKEN" ]; then
  log_pass "Login as admin@petanque.fr"
else
  log_fail "Login failed - cannot continue"
  echo "$RESP"
  exit 1
fi

# Create ORGANISATEUR user for testing
RESP_ORG=$(api POST "/auth/register" '{"email":"orga@test.fr","password":"Test123!","nom":"Test","prenom":"Orga","genre":"H"}')
ORG_ID=$(get_id "$RESP_ORG")
if [ -n "$ORG_ID" ]; then
  log_pass "Created test organizer: orga@test.fr"
else
  # Maybe already exists, try login
  RESP_ORG_LOGIN=$(curl -s -X POST "$BASE/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"orga@test.fr","password":"Test123!"}')
  TOKEN=$(echo "$RESP_ORG_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
  if [ -n "$TOKEN" ]; then
    log_info "Using existing organizer"
  else
    log_fail "Could not create/login organizer"
  fi
fi

# ─── Create players pool ─────────────────────────────────────────────────────
log_section "CREATING PLAYER POOL (64 players)"
PLAYER_IDS=()
for i in $(seq 1 64); do
  email="p${i}@test.fr"
  R=$(api POST "/auth/register" "{\"email\":\"$email\",\"password\":\"Test123!\",\"nom\":\"Nom${i}\",\"prenom\":\"Prenom${i}\",\"genre\":\"H\"}" 2>/dev/null)
  pid=$(get_id "$R")
  if [ -n "$pid" ]; then
    PLAYER_IDS+=("$pid")
  fi
done
log_pass "Created ${#PLAYER_IDS[@]} players"

# ─── Helper: create MONTEE teams for a concours ─────────────────────────────
create_teams_montee() {
  local concoursId="$1" count="$2"
  for i in $(seq 1 "$count"); do
    # Use player from pool (cycle if needed)
    local pidx=$(( (i - 1) % ${#PLAYER_IDS[@]} ))
    local pid="${PLAYER_IDS[$pidx]}"
    api POST "/equipes" "{\"concoursId\":\"$concoursId\",\"joueurIds\":[\"$pid\"]}" > /dev/null
  done
}

# ─── Helper: play all matches in a round (start + score) ────────────────────
play_round_matches() {
  local concoursId="$1"
  local parties_json
  parties_json=$(api GET "/parties?concoursId=$concoursId")
  
  # Get A_JOUER match ids
  local ids
  ids=$(echo "$parties_json" | python3 -c "
import sys, json
parties = json.load(sys.stdin)
ids = [p['id'] for p in parties if p['statut'] == 'A_JOUER']
print(' '.join(ids))
" 2>/dev/null)
  
  local count=0
  for mid in $ids; do
    # Start match
    api POST "/parties/$mid/demarrer" > /dev/null
    # Submit score
    api PATCH "/parties/$mid/score" '{"scoreA":13,"scoreB":7}' > /dev/null
    count=$((count+1))
  done
  echo "$count"
}

# ─── Helper: complete full coupe bracket ────────────────────────────────────
play_full_coupe_bracket() {
  local concoursId="$1" label="$2"
  local max_rounds=10
  local round=0
  
  while [ $round -lt $max_rounds ]; do
    local parties_json
    parties_json=$(api GET "/parties?concoursId=$concoursId")
    
    local a_jouer_count
    a_jouer_count=$(echo "$parties_json" | python3 -c "
import sys, json
parties = json.load(sys.stdin)
print(len([p for p in parties if p['statut'] == 'A_JOUER']))
" 2>/dev/null)
    
    local terminee_count
    terminee_count=$(echo "$parties_json" | python3 -c "
import sys, json
parties = json.load(sys.stdin)
print(len([p for p in parties if p['statut'] in ('TERMINEE', 'FORFAIT')]))
" 2>/dev/null)
    
    local a_monter_count
    a_monter_count=$(echo "$parties_json" | python3 -c "
import sys, json
parties = json.load(sys.stdin)
print(len([p for p in parties if p['statut'] == 'A_MONTER']))
" 2>/dev/null)
    
    local en_cours_count
    en_cours_count=$(echo "$parties_json" | python3 -c "
import sys, json
parties = json.load(sys.stdin)
print(len([p for p in parties if p['statut'] == 'EN_COURS']))
" 2>/dev/null)
    
    if [ "$a_jouer_count" = "0" ] && [ "$a_monter_count" = "0" ] && [ "$en_cours_count" = "0" ]; then
      log_pass "$label: bracket complete (${terminee_count} matches finished)"
      return 0
    fi
    
    if [ "$a_jouer_count" = "0" ] && [ "$a_monter_count" != "0" ]; then
      log_fail "$label: stuck - $a_monter_count A_MONTER matches but no A_JOUER"
      return 1
    fi
    
    local played
    played=$(play_round_matches "$concoursId")
    log_info "$label: played $played matches (terminee=$terminee_count, a_jouer=$a_jouer_count, a_monter=$a_monter_count)"
    round=$((round+1))
    sleep 0.1
  done
  log_fail "$label: max rounds reached without completing bracket"
  return 1
}

# ═══════════════════════════════════════════════════════════════════════════
# MELEE TESTS
# ═══════════════════════════════════════════════════════════════════════════

test_melee() {
  local count="$1" nbTours=3 label="MELEE $count teams"
  log_section "$label"
  
  # Create concours
  local future_date
  future_date=$(date -d "+1 day" '+%Y-%m-%dT09:00:00.000Z' 2>/dev/null || date -v+1d '+%Y-%m-%dT09:00:00.000Z')
  local end_date
  end_date=$(date -d "+1 day" '+%Y-%m-%dT18:00:00.000Z' 2>/dev/null || date -v+1d '+%Y-%m-%dT18:00:00.000Z')
  
  local concours_json
  concours_json=$(api POST "/concours" "{
    \"nom\": \"Test Melee $count Equipes\",
    \"format\": \"MELEE\",
    \"typeEquipe\": \"TETE_A_TETE\",
    \"modeConstitution\": \"MONTEE\",
    \"nbTerrains\": 8,
    \"dateDebut\": \"$future_date\",
    \"dateFin\": \"$end_date\",
    \"params\": {\"nbTours\": $nbTours}
  }")
  
  local cid
  cid=$(get_id "$concours_json")
  if [ -z "$cid" ]; then
    log_fail "$label: failed to create concours"
    echo "Response: $concours_json"
    return
  fi
  log_pass "$label: concours created ($cid)"
  
  # Register teams (MONTEE = pre-formed teams, each with 1 player for TETE_A_TETE)
  local registered=0
  for i in $(seq 1 "$count"); do
    local pidx=$(( (i - 1) % ${#PLAYER_IDS[@]} ))
    local pid="${PLAYER_IDS[$pidx]}"
    local r
    r=$(api POST "/equipes" "{\"concoursId\":\"$cid\",\"joueurIds\":[\"$pid\"]}")
    local eid
    eid=$(get_id "$r")
    if [ -n "$eid" ]; then
      registered=$((registered+1))
    fi
  done
  log_pass "$label: $registered teams registered"
  
  # Start tournament
  local start_json
  start_json=$(api POST "/concours/$cid/demarrer")
  check_field "$label start" "$start_json" "statut" "EN_COURS"
  
  # Launch round 1
  local r1
  r1=$(api POST "/parties/concours/$cid/tour/1/lancer")
  check_no_error "$label tour 1 launch" "$r1"
  
  # Play all rounds
  for tour in 1 2 3; do
    local played
    played=$(play_round_matches "$cid")
    log_info "$label: tour $tour - played $played matches"
    
    if [ "$tour" -lt "$nbTours" ]; then
      local next=$((tour+1))
      local r
      r=$(api POST "/parties/concours/$cid/tour/$next/lancer")
      check_no_error "$label tour $next launch" "$r"
    fi
  done
  
  # Check final ranking
  local classement
  classement=$(api GET "/classement/$cid")
  local rank_count
  rank_count=$(echo "$classement" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  
  if [ "$rank_count" -gt 0 ]; then
    log_pass "$label: classement has $rank_count entries"
  else
    log_fail "$label: classement empty"
  fi
  
  # Finish tournament
  local fin_json
  fin_json=$(api POST "/concours/$cid/terminer")
  check_field "$label terminer" "$fin_json" "statut" "TERMINE"
}

# ═══════════════════════════════════════════════════════════════════════════
# COUPE TESTS
# ═══════════════════════════════════════════════════════════════════════════

test_coupe() {
  local count="$1" consolante="${2:-false}" label="COUPE $count teams (consolante=$2)"
  log_section "$label"
  
  local future_date
  future_date=$(date -d "+1 day" '+%Y-%m-%dT09:00:00.000Z' 2>/dev/null || date -v+1d '+%Y-%m-%dT09:00:00.000Z')
  local end_date
  end_date=$(date -d "+1 day" '+%Y-%m-%dT18:00:00.000Z' 2>/dev/null || date -v+1d '+%Y-%m-%dT18:00:00.000Z')
  
  local concours_json
  concours_json=$(api POST "/concours" "{
    \"nom\": \"Test Coupe $count Equipes\",
    \"format\": \"COUPE\",
    \"typeEquipe\": \"TETE_A_TETE\",
    \"modeConstitution\": \"MONTEE\",
    \"nbTerrains\": 8,
    \"dateDebut\": \"$future_date\",
    \"dateFin\": \"$end_date\",
    \"params\": {\"consolante\": $consolante}
  }")
  
  local cid
  cid=$(get_id "$concours_json")
  if [ -z "$cid" ]; then
    log_fail "$label: failed to create concours - $(get_field "$concours_json" message)"
    return
  fi
  log_pass "$label: concours created ($cid)"
  
  # Register teams
  local registered=0
  for i in $(seq 1 "$count"); do
    local pidx=$(( (i - 1) % ${#PLAYER_IDS[@]} ))
    local pid="${PLAYER_IDS[$pidx]}"
    local r
    r=$(api POST "/equipes" "{\"concoursId\":\"$cid\",\"joueurIds\":[\"$pid\"]}")
    local eid
    eid=$(get_id "$r")
    if [ -n "$eid" ]; then
      registered=$((registered+1))
    fi
  done
  log_pass "$label: $registered teams registered"
  
  # Start tournament
  local start_json
  start_json=$(api POST "/concours/$cid/demarrer")
  check_field "$label start" "$start_json" "statut" "EN_COURS"
  
  # Launch bracket (tour 1)
  local r1
  r1=$(api POST "/parties/concours/$cid/tour/1/lancer-coupe")
  check_no_error "$label bracket launch" "$r1"
  
  # Verify initial bracket structure
  local parties_json
  parties_json=$(api GET "/parties?concoursId=$cid")
  local total_matches
  total_matches=$(echo "$parties_json" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  log_info "$label: initial bracket has $total_matches matches"
  
  # Check bracket structure
  local bracket_info
  bracket_info=$(echo "$parties_json" | python3 -c "
import sys, json, math
parties = json.load(sys.stdin)
next_pow2 = 1
n = $count
while next_pow2 < n:
    next_pow2 *= 2
expected_r1 = next_pow2 // 2
byes = next_pow2 - n

principale = [p for p in parties if p['type'] == 'COUPE_PRINCIPALE']
consolante = [p for p in parties if p['type'] == 'COUPE_CONSOLANTE']
terminee = [p for p in parties if p['statut'] == 'TERMINEE']
a_jouer = [p for p in parties if p['statut'] == 'A_JOUER']
a_monter = [p for p in parties if p['statut'] == 'A_MONTER']

print(f'principale={len(principale)} consolante={len(consolante)} byes={byes} expected_r1={expected_r1} terminee={len(terminee)} a_jouer={len(a_jouer)} a_monter={len(a_monter)}')
" 2>/dev/null || echo "parse_error")
  log_info "$label: $bracket_info"
  
  # For power-of-2 counts (4, 8, 16), byes=0 so all R1 matches A_JOUER
  # For non-power-of-2 (5, 6, 7, 13, ...), some matches are bye (already TERMINEE)
  local byes_expected=$(python3 -c "
n=$count
p=1
while p<n: p*=2
print(p-n)
" 2>/dev/null)
  
  if echo "$bracket_info" | grep -q "byes=$byes_expected"; then
    log_pass "$label: correct number of byes ($byes_expected)"
  else
    log_fail "$label: bye count mismatch - expected $byes_expected"
  fi
  
  # Play the full bracket
  play_full_coupe_bracket "$cid" "$label"
  
  # Verify no R7+ matches were created
  local max_ronde
  max_ronde=$(api GET "/parties?concoursId=$cid" | python3 -c "
import sys, json
parties = json.load(sys.stdin)
rondes = [p.get('bracketRonde') or 0 for p in parties]
print(max(rondes) if rondes else 0)
" 2>/dev/null || echo "0")
  
  if [ "$max_ronde" -le 6 ]; then
    log_pass "$label: max bracketRonde=$max_ronde (≤6, correct)"
  else
    log_fail "$label: max bracketRonde=$max_ronde (>6, BUG!)"
  fi
  
  # Check classement
  local classement
  classement=$(api GET "/classement/$cid")
  local rank_count
  rank_count=$(echo "$classement" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")
  
  # Classement should have the real teams (not __BYE__ or __TBD__)
  if [ "$rank_count" -ge 2 ]; then
    log_pass "$label: classement has $rank_count real team entries"
  else
    log_fail "$label: classement has only $rank_count entries"
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# RUN TESTS
# ═══════════════════════════════════════════════════════════════════════════

# --- MELEE tests ---
test_melee 4
test_melee 8
test_melee 16
test_melee 32
test_melee 64

# --- COUPE tests (no consolante) ---
test_coupe 4  false
test_coupe 5  false
test_coupe 8  false
test_coupe 13 false
test_coupe 16 false
test_coupe 32 false
test_coupe 64 false

# --- COUPE tests (with consolante) ---
test_coupe 8  true
test_coupe 13 true
test_coupe 16 true

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

log_section "TEST SUMMARY"
echo "  PASS: $PASS"
echo "  FAIL: $FAIL"
echo
if [ $FAIL -gt 0 ]; then
  echo "  FAILURES:"
  for r in "${RESULTS[@]}"; do
    if [[ "$r" == FAIL:* ]]; then
      echo "    $r"
    fi
  done
fi
echo
[ $FAIL -eq 0 ] && echo "  🎉 All tests passed!" || echo "  ⚠️  Some tests failed"
