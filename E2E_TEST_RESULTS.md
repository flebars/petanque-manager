# COUPE Tournament End-to-End Test Results

## Date
Mon Feb 23 2026

## Overview
Comprehensive end-to-end testing of the COUPE format (elimination bracket) with Consolante (repechage) support for an 8-team tournament.

## What Was Accomplished

### ✅ 1. Dynamic Finals Detection (Backend)
**Problem**: Finals detection was hardcoded to `bracketRonde === 5`, which failed for the Consolante bracket where Semi-Finals occur at Round 6.

**Solution**:
- Replaced hardcoded round check with dynamic detection based on completed matches count
- Semi-Finals are now detected when exactly 2 matches are completed at the current round
- Finals round is calculated dynamically as `semiFinalRonde + 1`
- Updated `progresserMatchBracket` and `createOrUpdateFinale` functions

**Files Modified**:
- `backend/src/modules/parties/parties.service.ts` (lines 664-698, 967-1040)

**Commit**: `412df8f` - "fix: Dynamic Finals detection for both Main and Consolante brackets"

### ✅ 2. Dynamic Round Labels (Frontend)
**Problem**: UI round labels were hardcoded (e.g., Round 6 = Finals), which didn't work for Consolante where Finals might be at Round 7.

**Solution**:
- Updated `getRoundLabel()` to detect Finals by checking for `bracketPos 0/1` instead of hardcoded round numbers
- Updated `getRoundShortLabel()` to handle rounds >= 6
- Updated `calculateExpectedMatchesForRound()` to handle rounds >= 6
- Changed `isFinale` detection to use `bracketPos` instead of `bracketRonde`
- Updated placeholder detection logic

**Files Modified**:
- `frontend/src/components/match/BracketView.tsx` (lines 32-53, 260-299)

**Commit**: `412df8f` - "fix: Dynamic Finals detection for both Main and Consolante brackets"

### ✅ 3. TypeScript Fixes
**Problem**: TypeScript errors due to `partie.concours` relation not being included in type inference.

**Solution**:
- Fetch `concours` separately when needed in `saisirScore` and `forfaitAvantMatch`
- This avoids TypeScript errors while maintaining functionality

**Files Modified**:
- `backend/src/modules/parties/parties.service.ts` (lines 99-109, 146-154)

**Commit**: `145d809` - "fix: Fetch concours separately in score validation to avoid TypeScript errors"

### ✅ 4. E2E Test Infrastructure
**Created**: `test-coupe-e2e.sh` - Comprehensive bash script that:
- Creates and launches an 8-team COUPE tournament
- Plays through all rounds systematically
- Validates bracket progression at each step
- Verifies Finals creation for both Main and Consolante brackets
- Displays final rankings

## Current Status

### Main Bracket: ✅ WORKING PERFECTLY
For an 8-team tournament:
- **Round 4** (Quarter-Finals): 4 matches → 4 winners, 4 losers
- **Round 5** (Semi-Finals): 2 matches → 2 winners, 2 losers
- **Round 6** (Finals): 2 matches
  - Pos 0: Grande Finale (winners from SF)
  - Pos 1: Petite Finale (losers from SF, for 3rd place)

✅ All matches created correctly
✅ Winners progress properly
✅ Both Grande and Petite Finales created

### Consolante Bracket: ⚠️ PARTIAL - Petite Finale Missing
For 4 losers from Main QF:
- **Round 5** (Consolante Semi-Finals): 2 matches → 2 winners, 2 losers
- **Round 6** (Consolante Finals): **ONLY 1 MATCH CREATED** ❌
  - Pos 0: Grande Finale (for 5th place) ✅ Created
  - Pos 1: Petite Finale (for 7th place) ❌ **MISSING**

### Actual vs Expected Bracket Structure

#### Expected for 8-Team Tournament:
```
MAIN BRACKET:
Round 4 (QF):  [M0] [M1] [M2] [M3]  → 4 winners to R5, 4 losers to Consolante R5
Round 5 (SF):  [M0] [M1]             → 2 winners to R6, 2 losers to R6
Round 6 (F):   [Grande] [Petite]    → Rankings 1-4

CONSOLANTE:
Round 5 (SF):  [M0] [M1]             → 2 winners to R6, 2 losers to R6
Round 6 (F):   [Grande] [Petite]    → Rankings 5-8
```

#### Actual Observed:
```
MAIN BRACKET: ✅ CORRECT
Round 4 (QF):  [M0] [M1] [M2] [M3]
Round 5 (SF):  [M0] [M1]
Round 6 (F):   [Grande P0] [Petite P1]

CONSOLANTE: ❌ MISSING PETITE FINALE
Round 5 (SF):  [M0] [M1]
Round 6 (F):   [Grande P0] only
Round 7:       [Placeholder P0]     ← Created by progression, shouldn't exist
```

## Investigation: Why is Petite Finale Missing?

### Code Analysis
The `createOrUpdateFinale()` function (lines 967-1040) should create both matches:

```typescript
if (demiFinales.length === 2) {
  const winners = demiFinales.map(m => /* ... */);
  const losers = demiFinales.map(m => /* ... */);
  const finaleRonde = semiFinalRonde + 1;
  
  // Grande Finale - Pos 0
  if (!grandeFinale) {
    // Create Grande Finale
  }
  
  // Petite Finale - Pos 1  
  if (!petiteFinale) {
    // Create Petite Finale ← THIS SHOULD EXECUTE BUT DOESN'T
  }
}
```

###Hypothesis
1. **Timing Issue**: When Round 5 Pos 1 (bye match) completes first, it triggers progression to Round 6 Pos 0 (creates placeholder)
2. **Partial Creation**: When Round 5 Pos 0 completes, it detects 2 Semi-Finals and calls `createOrUpdateFinale()`
3. **Grande Finale exists**: The check `if (!grandeFinale)` finds the placeholder from step 1, so skips creation
4. **Petite Finale should be created**: The check `if (!petiteFinale)` should find nothing and create it
5. **But it doesn't**: Something is preventing the Petite Finale creation

### Possible Causes
- **Silent Exception**: An error is being thrown but caught/swallowed
- **Logic Bug**: The `losers` array might be empty or invalid
- **Race Condition**: Multiple requests might be interfering
- **Database Constraint**: Unique constraint violation?

### Next Steps to Debug
1. Add explicit console.log before and after Petite Finale creation
2. Check if `losers` array has 2 elements
3. Verify the `finaleRonde` value is correct (should be 6 for Consolante)
4. Check backend logs for any errors or exceptions
5. Add try-catch with explicit error logging

## Test Results Summary

### Matches Played
- Main Bracket: 8 matches (4 QF + 2 SF + 2 Finals) ✅
- Consolante: 3 matches (2 SF + 1 Finale) ⚠️ (should be 4)

### Total: 11 matches completed, 1 missing

### Rankings
The ranking system works correctly for the matches that exist:
- Ranks teams based on victories → quotient → points scored
- Handles bye matches properly (13-0 auto-win)

## Browser Testing
Tournament can be viewed at:
```
http://localhost:5173/concours/f1260530-61e7-432d-ae8e-679840026cd5
```

**UI Observations**:
- Main bracket displays correctly with proper round labels
- Consolante bracket displays but is missing the Petite Finale
- Placeholder matches show "En attente de l'adversaire" correctly
- Round navigation works well

## Remaining Work

### High Priority
1. **Fix Consolante Petite Finale Creation** ❗
   - Debug why the Petite Finale is not created at Round 6 Pos 1
   - Ensure both Grande and Petite Finales are created for Consolante
   - Add unit tests for this scenario

2. **Validate 16-Team, 32-Team, 64-Team Tournaments**
   - Test larger brackets to ensure dynamic detection works at all scales
   - Consolante for 16 teams: R4→R5→R6→R7 (Grande+Petite at R7)
   - Consolante for 32 teams: R3→R4→R5→R6→R7 (Grande+Petite at R7)

### Medium Priority
3. **Add Comprehensive Unit Tests**
   - Test `progresserMatchBracket()` with various bracket sizes
   - Test `createOrUpdateFinale()` for both Main and Consolante
   - Test edge cases (byes, forfeits, all at once)

4. **Improve Error Handling**
   - Add explicit error logging for Finals creation
   - Handle edge cases (what if only 1 SF match exists?)
   - Add validation for bracket integrity

### Low Priority
5. **UI Enhancements**
   - Add visual indicator when Petite Finale is missing (for debugging)
   - Show bracket tree view instead of round-by-round tabs
   - Add "bracket health check" admin tool

## Commands to Reproduce

### Create Fresh 8-Team Tournament
```bash
cd /home/flb/workspace/petanque-manager
./test-coupe-e2e.sh
```

### Check Backend Logs
```bash
docker logs -f petanque-backend 2>&1 | grep -E "\[BRACKET\]|ERROR"
```

### Manual API Testing
```bash
# Login
TOKEN=$(curl -s -X POST "http://localhost:3000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"organizer-8team@test.com","password":"Test123!"}' | \
  jq -r '.accessToken')

# Get Consolante matches
curl -s -X GET "http://localhost:3000/parties?concoursId=f1260530-61e7-432d-ae8e-679840026cd5" \
  -H "Authorization: Bearer $TOKEN" | \
  jq '.[] | select(.type == "COUPE_CONSOLANTE") | {ronde, pos: .bracketPos, statut}'
```

## Conclusion

We've made significant progress on the COUPE tournament implementation:
- ✅ Main bracket works perfectly from QF to Finals
- ✅ Dynamic round detection replaces hardcoded logic
- ✅ UI handles variable bracket structures  
- ⚠️ Consolante bracket is 95% working, with 1 critical bug

The remaining issue (Consolante Petite Finale) appears to be a localized problem in the Finals creation logic that should be straightforward to fix once the root cause is identified through detailed logging.

**Overall Assessment**: The refactoring to dynamic Finals detection was successful and the system is much more robust. The Petite Finale bug is a regression that needs immediate attention before this can be considered production-ready.
