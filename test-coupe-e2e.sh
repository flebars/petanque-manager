#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:3000"
CONCOURS_ID="f1260530-61e7-432d-ae8e-679840026cd5"

# Login
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer-8team@test.com","password":"Test123!"}')
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  COUPE Tournament E2E Test${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to play a match
play_match() {
  local MATCH_ID=$1
  local SCORE_A=$2
  local SCORE_B=$3
  
  # Start match
  curl -s -X POST "$BASE_URL/parties/$MATCH_ID/demarrer" \
    -H "Authorization: Bearer $TOKEN" > /dev/null
  
  # Score match
  curl -s -X PATCH "$BASE_URL/parties/$MATCH_ID/score" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"scoreA\":$SCORE_A,\"scoreB\":$SCORE_B}" > /dev/null
}

# Function to show bracket state
show_bracket() {
  local ROUND=$1
  local TYPE=$2
  local TITLE=$3
  
  echo -e "${YELLOW}=== $TITLE ===${NC}"
  curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r ".[] | select(.type == \"$TYPE\" and .bracketRonde == $ROUND) | \"Pos \(.bracketPos): \(.equipeAId[:8]) vs \(.equipeBId[:8]) - Score: \(.scoreA // \"?\"):\(.scoreB // \"?\") - Status: \(.statut)\""
  echo ""
}

# QUARTER-FINALS (Main Bracket Round 4)
echo -e "${GREEN}Step 1: Playing Quarter-Finals (Main Bracket)${NC}"
show_bracket 4 "COUPE_PRINCIPALE" "Quarter-Finals (Round 4)"

QF_MATCHES=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.type == "COUPE_PRINCIPALE" and .bracketRonde == 4) | .id')

MATCH_NUM=1
for MATCH_ID in $QF_MATCHES; do
  echo -e "  ${BLUE}Playing QF Match $MATCH_NUM...${NC}"
  play_match "$MATCH_ID" 13 $((7 - MATCH_NUM))
  MATCH_NUM=$((MATCH_NUM + 1))
done

echo -e "${GREEN}✓ Quarter-Finals completed!${NC}"
echo ""

sleep 1

# Show Semi-Finals
echo -e "${GREEN}Step 2: Semi-Finals Created${NC}"
show_bracket 5 "COUPE_PRINCIPALE" "Semi-Finals (Main Bracket Round 5)"

# Show Consolante First Round
echo -e "${GREEN}Step 3: Consolante First Round Created${NC}"
show_bracket 5 "COUPE_CONSOLANTE" "Consolante Round 5"

# Play Semi-Finals
echo -e "${GREEN}Step 4: Playing Semi-Finals${NC}"
SF_MATCHES=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.type == "COUPE_PRINCIPALE" and .bracketRonde == 5 and .equipeAId != .equipeBId) | .id')

MATCH_NUM=1
for MATCH_ID in $SF_MATCHES; do
  echo -e "  ${BLUE}Playing SF Match $MATCH_NUM...${NC}"
  play_match "$MATCH_ID" 13 $((4 + MATCH_NUM))
  MATCH_NUM=$((MATCH_NUM + 1))
done

echo -e "${GREEN}✓ Semi-Finals completed!${NC}"
echo ""

sleep 1

# Show Main Bracket Finals
echo -e "${GREEN}Step 5: Main Bracket Finals Created${NC}"
show_bracket 6 "COUPE_PRINCIPALE" "Main Bracket Finals (Round 6)"

# Play Consolante Round 5
echo -e "${GREEN}Step 6: Playing Consolante Round 5${NC}"
CONS_R5_MATCHES=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.type == "COUPE_CONSOLANTE" and .bracketRonde == 5 and .equipeAId != .equipeBId and .statut != "TERMINEE") | .id')

MATCH_NUM=1
for MATCH_ID in $CONS_R5_MATCHES; do
  echo -e "  ${BLUE}Playing Consolante R5 Match $MATCH_NUM...${NC}"
  play_match "$MATCH_ID" 13 $((8 + MATCH_NUM))
  MATCH_NUM=$((MATCH_NUM + 1))
done

echo -e "${GREEN}✓ Consolante Round 5 completed!${NC}"
echo ""

sleep 1

# Show Consolante Semi-Finals
echo -e "${GREEN}Step 7: Consolante Semi-Finals Created${NC}"
show_bracket 6 "COUPE_CONSOLANTE" "Consolante Semi-Finals (Round 6)"

# Play Consolante Semi-Finals
echo -e "${GREEN}Step 8: Playing Consolante Semi-Finals${NC}"
CONS_SF_MATCHES=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.type == "COUPE_CONSOLANTE" and .bracketRonde == 6 and .equipeAId != .equipeBId and .statut != "TERMINEE") | .id')

MATCH_NUM=1
for MATCH_ID in $CONS_SF_MATCHES; do
  echo -e "  ${BLUE}Playing Consolante SF Match $MATCH_NUM...${NC}"
  play_match "$MATCH_ID" 13 $((9 + MATCH_NUM))
  MATCH_NUM=$((MATCH_NUM + 1))
done

echo -e "${GREEN}✓ Consolante Semi-Finals completed!${NC}"
echo ""

sleep 1

# Show Consolante Finals
echo -e "${GREEN}Step 9: Consolante Finals Created (Round 7)${NC}"
show_bracket 7 "COUPE_CONSOLANTE" "Consolante Finals (Round 7)"

CONS_FINALS_COUNT=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | select(.type == "COUPE_CONSOLANTE" and .bracketRonde == 7)] | length')

if [ "$CONS_FINALS_COUNT" -eq "2" ]; then
  echo -e "${GREEN}✓ SUCCESS: Both Consolante Finals (Grande + Petite) created at Round 7!${NC}"
else
  echo -e "${RED}✗ FAILURE: Expected 2 Consolante Finals, found $CONS_FINALS_COUNT${NC}"
fi

echo ""

# Play Main Finals
echo -e "${GREEN}Step 10: Playing Main Bracket Finals${NC}"
MAIN_FINALS=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.type == "COUPE_PRINCIPALE" and .bracketRonde == 6 and .equipeAId != .equipeBId) | .id')

for MATCH_ID in $MAIN_FINALS; do
  POS=$(curl -s -X GET "$BASE_URL/parties/$MATCH_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.bracketPos')
  if [ "$POS" -eq "0" ]; then
    echo -e "  ${BLUE}Playing Grande Finale...${NC}"
    play_match "$MATCH_ID" 13 11
  else
    echo -e "  ${BLUE}Playing Petite Finale...${NC}"
    play_match "$MATCH_ID" 13 10
  fi
done

echo -e "${GREEN}✓ Main Finals completed!${NC}"
echo ""

# Play Consolante Finals
echo -e "${GREEN}Step 11: Playing Consolante Finals${NC}"
CONS_FINALS=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | select(.type == "COUPE_CONSOLANTE" and .bracketRonde == 7 and .equipeAId != .equipeBId) | .id')

for MATCH_ID in $CONS_FINALS; do
  POS=$(curl -s -X GET "$BASE_URL/parties/$MATCH_ID" \
    -H "Authorization: Bearer $TOKEN" | jq -r '.bracketPos')
  if [ "$POS" -eq "0" ]; then
    echo -e "  ${BLUE}Playing Consolante Grande Finale (5th place)...${NC}"
    play_match "$MATCH_ID" 13 6
  else
    echo -e "  ${BLUE}Playing Consolante Petite Finale (7th place)...${NC}"
    play_match "$MATCH_ID" 13 5
  fi
done

echo -e "${GREEN}✓ Consolante Finals completed!${NC}"
echo ""

# Final verification
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  FINAL VERIFICATION${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

TOTAL_MATCHES=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | select(.statut == "TERMINEE")] | length')

MAIN_COMPLETED=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | select(.type == "COUPE_PRINCIPALE" and .statut == "TERMINEE")] | length')

CONS_COMPLETED=$(curl -s -X GET "$BASE_URL/parties?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq '[.[] | select(.type == "COUPE_CONSOLANTE" and .statut == "TERMINEE")] | length')

echo -e "${GREEN}Total matches completed: $TOTAL_MATCHES${NC}"
echo -e "${GREEN}Main bracket completed: $MAIN_COMPLETED${NC}"
echo -e "${GREEN}Consolante completed: $CONS_COMPLETED${NC}"
echo ""

# Show ranking
echo -e "${YELLOW}Final Rankings:${NC}"
curl -s -X GET "$BASE_URL/classement?concoursId=$CONCOURS_ID" \
  -H "Authorization: Bearer $TOKEN" | jq -r '.[] | "\(.rang). \(.equipe.joueurs[0].joueur.prenom) - \(.victoires)W \(.defaites)L - Points: \(.pointsMarques)/\(.pointsEncaisses)"'

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  E2E TEST COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}View tournament in browser:${NC}"
echo -e "http://localhost:5173/concours/$CONCOURS_ID"
