# Bracket Round Fix - 5 Rounds for 26 Teams

## Problem
With 26 teams (expanding to 32 slots), the bracket was only showing 4 rounds instead of the correct 5 rounds:
- **Incorrect**: Seizièmes → Quarts → Demi-finales → Finales (4 rounds)
- **Correct**: Seizièmes → Huitièmes → Quarts → Demi-finales → Finales (5 rounds)

## Root Cause
The backend's `calculateBracketRonde()` function had hardcoded values that only supported tournaments up to 8 teams (4 rounds maximum).

## Solution

### Backend Changes (`parties.service.ts`)

**Before:**
```typescript
private calculateBracketRonde(matchCount: number): number {
  if (matchCount === 1) return 4;  // Finale
  if (matchCount === 2) return 3;  // Demi-finales
  if (matchCount === 4) return 2;  // Quarts
  return 1;  // Everything else (8+ matches)
}
```

**After:**
```typescript
private calculateBracketRonde(matchCount: number): number {
  if (matchCount === 1) return 5;  // Finales (Grande + Petite)
  if (matchCount === 2) return 4;  // Demi-finales
  if (matchCount === 4) return 3;  // Quarts de finale
  if (matchCount === 8) return 2;  // Huitièmes de finale
  return 1;  // Seizièmes de finale (16+ matches)
}
```

### Frontend Changes (`BracketView.tsx`)

1. **Updated `calculateExpectedMatchesForRound()`**:
   - Now handles `bracketRonde` values 1-5
   - `bracketRonde: 1` → 16 matches (Seizièmes)
   - `bracketRonde: 2` → 8 matches (Huitièmes)
   - `bracketRonde: 3` → 4 matches (Quarts)
   - `bracketRonde: 4` → 2 matches (Demi-finales)
   - `bracketRonde: 5` → 2 matches (Finales)

2. **Added `calculateMaxBracketRonde()`**:
   - Determines total rounds based on first-round match count
   - 16+ matches → 5 rounds
   - 8+ matches → 4 rounds
   - 4+ matches → 3 rounds
   - 2+ matches → 2 rounds

3. **Updated `getRoundLabel()`**:
   ```typescript
   case '5': return 'Finales';
   case '4': return 'Demi-finales';
   case '3': return 'Quarts de finale';
   case '2': return 'Huitièmes de finale';
   case '1': return 'Seizièmes de finale';
   ```

4. **Fixed finale detection**:
   - Changed from `ronde === '4'` to `ronde === '5'`
   - Updated `isGrandeFinale` and `isPetiteFinale` checks to use `bracketRonde === 5`

5. **Fixed connection lines**:
   - Changed from `ronde !== '4'` to `ronde !== '5'` (no lines on final round)

## Bracket Structure by Team Count

| Teams | Expands To | Rounds | Structure |
|-------|-----------|--------|-----------|
| 2-4   | 4         | 2      | Demi-finales → Finales |
| 5-8   | 8         | 3      | Quarts → Demi-finales → Finales |
| 9-16  | 16        | 4      | Huitièmes → Quarts → Demi-finales → Finales |
| 17-32 | 32        | 5      | **Seizièmes → Huitièmes → Quarts → Demi-finales → Finales** |

## Verification for 26 Teams

With 26 teams (expanding to 32 slots):

**Round 1 (bracketRonde: 1)** - Seizièmes de finale
- 16 matches expected
- Actual: 13 real matches + 3 byes (automatically won)

**Round 2 (bracketRonde: 2)** - Huitièmes de finale
- 8 placeholder matches ("À venir")
- Created when Tour 2 is launched with winners from Round 1

**Round 3 (bracketRonde: 3)** - Quarts de finale
- 4 placeholder matches
- Created when Tour 3 is launched

**Round 4 (bracketRonde: 4)** - Demi-finales
- 2 placeholder matches
- Created when Tour 4 is launched

**Round 5 (bracketRonde: 5)** - Finales
- 2 placeholder matches
  - Position 0: 🏆 Grande Finale
  - Position 1: 🥉 Petite Finale (3rd place)
- Created when Tour 5 is launched

## Testing

**Old tournament data is incompatible!** You need to create a new tournament because:
- Old matches have `bracketRonde: 1` (under old system)
- New backend expects `bracketRonde: 1-5` (new system)

### Create New Test Tournament

1. Delete old tournament or create a fresh one
2. Register 26 teams
3. Start tournament
4. Launch Tour 1 ("Lancer Tableau")
5. Verify 5 rounds are displayed:
   - Seizièmes (16 matches)
   - Huitièmes (8 placeholders)
   - Quarts (4 placeholders)
   - Demi-finales (2 placeholders)
   - Finales (2 placeholders with Grande/Petite labels)

## Files Modified

- **Backend**: `backend/src/modules/parties/parties.service.ts` (line 748)
- **Frontend**: `frontend/src/components/match/BracketView.tsx` (lines 32-200)

## Breaking Change

⚠️ **This is a breaking change for existing COUPE tournaments!**

Any tournament created before this fix will have incorrect `bracketRonde` values in the database. You must:
1. Delete and recreate test tournaments, OR
2. Run a data migration to update existing `bracketRonde` values in the `parties` table
