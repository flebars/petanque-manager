#!/usr/bin/env python3
"""
Full E2E test for Petanque Manager
Tests MELEE and COUPE formats with various team counts via API
"""

import sys
import json
import time
import math
import subprocess
import urllib.request
import urllib.error

BASE = "http://localhost:3000"
PASS = 0
FAIL = 0
FAILURES = []


def api(method: str, path: str, data: dict = None, token: str = None) -> dict:
    url = BASE + path
    body = json.dumps(data).encode() if data else None
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read())
        except Exception:
            return {"error": str(e), "statusCode": e.code}
    except Exception as e:
        return {"error": str(e)}


def ok(label: str):
    global PASS
    PASS += 1
    print(f"  ✅ {label}")


def fail(label: str, detail: str = ""):
    global FAIL
    FAIL += 1
    msg = f"{label}" + (f": {detail}" if detail else "")
    FAILURES.append(msg)
    print(f"  ❌ {msg}")


def section(title: str):
    print(f"\n{'═'*52}")
    print(f"  {title}")
    print(f"{'═'*52}")


def info(msg: str):
    print(f"  ℹ  {msg}")


def next_power_of_2(n: int) -> int:
    p = 1
    while p < n:
        p *= 2
    return p


def get_player_ids_from_db() -> list:
    result = subprocess.run(
        ["docker", "exec", "ee9b075c299c", "psql", "-U", "postgres", "-d", "petanque",
         "-t", "-c", "SELECT json_agg(id ORDER BY email) FROM joueurs WHERE email LIKE '%@e2e.fr';"],
        capture_output=True, text=True
    )
    return json.loads(result.stdout.strip())


# ─── Login ────────────────────────────────────────────────────────────────
section("AUTHENTICATION")
resp = api("POST", "/auth/login", {"email": "admin@petanque.fr", "password": "admin1234"})
TOKEN = resp.get("accessToken")
if TOKEN:
    ok("Login as admin@petanque.fr")
else:
    fail("Login failed - cannot continue")
    sys.exit(1)


# ─── Get player IDs ────────────────────────────────────────────────────────
section("SETUP PLAYER POOL")
PLAYER_IDS = get_player_ids_from_db()
info(f"Using {len(PLAYER_IDS)} pre-created players from DB")
if len(PLAYER_IDS) >= 64:
    ok(f"Player pool ready: {len(PLAYER_IDS)} players")
else:
    fail(f"Player pool too small: {len(PLAYER_IDS)} players")


def create_concours(nom: str, format: str, nb_terrains: int = 8, consolante: bool = False, nb_tours: int = 3) -> str:
    data = {
        "nom": nom,
        "format": format,
        "typeEquipe": "TETE_A_TETE",
        "modeConstitution": "MONTEE",
        "nbTerrains": nb_terrains,
        "dateDebut": "2026-06-01T09:00:00.000Z",
        "dateFin": "2026-06-01T18:00:00.000Z",
    }
    if format == "MELEE":
        data["nbTours"] = nb_tours
    elif format == "COUPE":
        data["consolante"] = consolante
    resp = api("POST", "/concours", data, TOKEN)
    return resp.get("id", "")


def register_teams(concours_id: str, count: int) -> int:
    registered = 0
    for i in range(count):
        pid = PLAYER_IDS[i % len(PLAYER_IDS)]
        resp = api("POST", "/equipes", {"concoursId": concours_id, "joueurIds": [pid]}, TOKEN)
        if resp.get("id"):
            registered += 1
    return registered


def get_parties(concours_id: str) -> list:
    return api("GET", f"/parties?concoursId={concours_id}", token=TOKEN)


def play_round_matches(concours_id: str) -> int:
    parties = get_parties(concours_id)
    if not isinstance(parties, list):
        return 0
    a_jouer = [p for p in parties if p.get("statut") == "A_JOUER"]
    played = 0
    for m in a_jouer:
        mid = m["id"]
        # Start match
        api("POST", f"/parties/{mid}/demarrer", token=TOKEN)
        # Score: 13-7 (equipeA wins)
        api("PATCH", f"/parties/{mid}/score", {"scoreA": 13, "scoreB": 7}, TOKEN)
        played += 1
    return played


def play_full_bracket(concours_id: str, label: str, max_iters: int = 20) -> bool:
    for iteration in range(max_iters):
        parties = get_parties(concours_id)
        if not isinstance(parties, list):
            fail(f"{label}: could not get parties")
            return False

        a_jouer = [p for p in parties if p.get("statut") == "A_JOUER"]
        a_monter = [p for p in parties if p.get("statut") == "A_MONTER"]
        en_cours = [p for p in parties if p.get("statut") == "EN_COURS"]
        terminee = [p for p in parties if p.get("statut") in ("TERMINEE", "FORFAIT")]

        if len(a_jouer) == 0 and len(a_monter) == 0 and len(en_cours) == 0:
            ok(f"{label}: bracket complete ({len(terminee)} matches finished)")
            return True

        if len(a_jouer) == 0 and len(a_monter) > 0:
            fail(f"{label}: stuck at iter {iteration}: {len(a_monter)} A_MONTER but 0 A_JOUER")
            return False

        played = play_round_matches(concours_id)
        info(f"{label} iter {iteration}: played={played}, terminee={len(terminee)}, a_jouer={len(a_jouer)}, a_monter={len(a_monter)}")

    fail(f"{label}: max iterations reached without completing bracket")
    return False


def verify_classement_no_placeholders(concours_id: str, label: str):
    resp = api("GET", f"/classement/concours/{concours_id}", token=TOKEN)
    if not isinstance(resp, list):
        fail(f"{label}: classement not a list")
        return
    team_names = []
    for entry in resp:
        equipe = entry.get("equipe", {})
        nom = equipe.get("nom", "")
        team_names.append(nom)
    placeholders = [n for n in team_names if n in ("__BYE__", "__TBD__")]
    if placeholders:
        fail(f"{label}: placeholders in classement: {placeholders}")
    elif len(resp) >= 2:
        ok(f"{label}: classement has {len(resp)} entries, no placeholders")
    else:
        fail(f"{label}: classement too small: {len(resp)} entries")


def verify_no_r7_matches(concours_id: str, label: str):
    parties = get_parties(concours_id)
    if not isinstance(parties, list):
        return
    max_ronde = max((p.get("bracketRonde") or 0 for p in parties), default=0)
    if max_ronde <= 6:
        ok(f"{label}: max bracketRonde={max_ronde} (≤6)")
    else:
        fail(f"{label}: max bracketRonde={max_ronde} (>6, BUG!)")


def verify_bracket_structure(concours_id: str, label: str, team_count: int, consolante: bool):
    parties = get_parties(concours_id)
    if not isinstance(parties, list):
        return

    expected_p2 = next_power_of_2(team_count)
    expected_byes = expected_p2 - team_count
    expected_r1_matches = expected_p2 // 2

    principale = [p for p in parties if p.get("type") == "COUPE_PRINCIPALE"]
    consolante_parties = [p for p in parties if p.get("type") == "COUPE_CONSOLANTE"]
    terminee_r1 = [p for p in principale if p.get("tour") == 1 and p.get("statut") in ("TERMINEE", "FORFAIT")]
    a_jouer_r1 = [p for p in principale if p.get("tour") == 1 and p.get("statut") in ("A_JOUER", "EN_COURS")]
    a_monter_r1 = [p for p in principale if p.get("tour") == 1 and p.get("statut") == "A_MONTER"]

    # Total R1 matches = expected_r1_matches
    total_r1 = len(terminee_r1) + len(a_jouer_r1) + len(a_monter_r1)
    if total_r1 == expected_r1_matches:
        ok(f"{label}: R1 has {total_r1} matches (correct)")
    else:
        fail(f"{label}: R1 has {total_r1} matches (expected {expected_r1_matches})")

    # Bye matches (already TERMINEE on R1)
    if len(terminee_r1) == expected_byes:
        ok(f"{label}: {expected_byes} bye matches correctly auto-completed")
    else:
        fail(f"{label}: expected {expected_byes} bye matches, got {len(terminee_r1)} terminee on R1")

    # Consolante
    if consolante:
        if team_count > 2:
            expected_consolante = expected_r1_matches // 2
            if len(consolante_parties) >= expected_consolante:
                ok(f"{label}: consolante has {len(consolante_parties)} initial matches")
            else:
                fail(f"{label}: consolante missing matches: {len(consolante_parties)} < {expected_consolante}")
        else:
            info(f"{label}: consolante not created for 2-team bracket")


# ═══════════════════════════════════════════════════════════════════════════
# MELEE TESTS
# ═══════════════════════════════════════════════════════════════════════════

def test_melee(count: int, nb_tours: int = 3):
    label = f"MELEE {count} teams"
    section(label)

    cid = create_concours(f"Test Melee {count}", "MELEE", nb_tours=nb_tours)
    if not cid:
        fail(f"{label}: failed to create concours")
        return
    ok(f"{label}: concours created")

    reg = register_teams(cid, count)
    if reg == count:
        ok(f"{label}: {reg} teams registered")
    else:
        fail(f"{label}: only {reg}/{count} teams registered")

    resp = api("POST", f"/concours/{cid}/demarrer", token=TOKEN)
    if resp.get("statut") == "EN_COURS":
        ok(f"{label}: started")
    else:
        fail(f"{label}: start failed", resp.get("message", ""))
        return

    # Launch + play rounds
    for tour in range(1, nb_tours + 1):
        if tour == 1:
            r = api("POST", f"/parties/concours/{cid}/tour/1/lancer", token=TOKEN)
            if isinstance(r, list):
                ok(f"{label}: tour 1 launched ({len(r)} matches)")
            else:
                fail(f"{label}: tour 1 launch failed", r.get("message", ""))
                return

        played = play_round_matches(cid)
        ok(f"{label}: tour {tour} - played {played} matches")

        if tour < nb_tours:
            r = api("POST", f"/parties/concours/{cid}/tour/{tour+1}/lancer", token=TOKEN)
            if isinstance(r, list):
                ok(f"{label}: tour {tour+1} launched ({len(r)} matches)")
            else:
                fail(f"{label}: tour {tour+1} launch failed", r.get("message", ""))
                return

    verify_classement_no_placeholders(cid, label)

    resp = api("POST", f"/concours/{cid}/terminer", token=TOKEN)
    if resp.get("statut") == "TERMINE":
        ok(f"{label}: tournament finished")
    else:
        fail(f"{label}: finish failed", resp.get("message", ""))


# ═══════════════════════════════════════════════════════════════════════════
# COUPE TESTS
# ═══════════════════════════════════════════════════════════════════════════

def test_coupe(count: int, consolante: bool = False):
    cons_str = "+consolante" if consolante else ""
    label = f"COUPE {count} teams{cons_str}"
    section(label)

    cid = create_concours(f"Test Coupe {count}{cons_str}", "COUPE", consolante=consolante)
    if not cid:
        fail(f"{label}: failed to create concours")
        return
    ok(f"{label}: concours created")

    reg = register_teams(cid, count)
    if reg == count:
        ok(f"{label}: {reg} teams registered")
    else:
        fail(f"{label}: only {reg}/{count} teams registered")

    resp = api("POST", f"/concours/{cid}/demarrer", token=TOKEN)
    if resp.get("statut") == "EN_COURS":
        ok(f"{label}: started")
    else:
        fail(f"{label}: start failed", resp.get("message", ""))
        return

    r = api("POST", f"/parties/concours/{cid}/tour/1/lancer-coupe", token=TOKEN)
    if isinstance(r, list):
        ok(f"{label}: bracket launched ({len(r)} initial matches)")
    else:
        fail(f"{label}: bracket launch failed", r.get("message", ""))
        return

    # Verify initial structure
    verify_bracket_structure(cid, label, count, consolante)

    # Play the full bracket
    success = play_full_bracket(cid, label)
    if not success:
        return

    # Verify no R7+ matches
    verify_no_r7_matches(cid, label)

    # Verify classement
    verify_classement_no_placeholders(cid, label)


# ═══════════════════════════════════════════════════════════════════════════
# EXECUTE TESTS
# ═══════════════════════════════════════════════════════════════════════════

# MELEE
test_melee(4,  nb_tours=3)
test_melee(5,  nb_tours=3)    # odd teams → bye
test_melee(8,  nb_tours=3)
test_melee(16, nb_tours=4)
test_melee(32, nb_tours=5)
test_melee(64, nb_tours=6)

# COUPE (no consolante) - various sizes including non-powers of 2
test_coupe(4,  consolante=False)
test_coupe(5,  consolante=False)   # 5→8 bracket, 3 byes
test_coupe(6,  consolante=False)   # 6→8 bracket, 2 byes
test_coupe(7,  consolante=False)   # 7→8 bracket, 1 bye
test_coupe(8,  consolante=False)   # perfect power of 2
test_coupe(13, consolante=False)   # 13→16, 3 byes
test_coupe(16, consolante=False)   # perfect
test_coupe(32, consolante=False)
test_coupe(64, consolante=False)

# COUPE with consolante
test_coupe(8,  consolante=True)
test_coupe(13, consolante=True)
test_coupe(16, consolante=True)

# ═══════════════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════════════

section("TEST SUMMARY")
print(f"  PASS: {PASS}")
print(f"  FAIL: {FAIL}")
if FAILURES:
    print("\n  FAILURES:")
    for f_msg in FAILURES:
        print(f"    ❌ {f_msg}")
print()
if FAIL == 0:
    print("  🎉 All tests passed!")
else:
    print(f"  ⚠️  {FAIL} test(s) failed")

sys.exit(0 if FAIL == 0 else 1)
