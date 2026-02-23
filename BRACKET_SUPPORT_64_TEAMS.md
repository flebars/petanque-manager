# Bracket Support - Up to 64 Teams (6 Rounds)

## Overview
The bracket system now supports tournaments from 4 teams up to 64 teams, with proper French naming conventions for each round.

## Bracket Round Numbering System

The backend uses a **fixed numbering system** based on match count:

| Match Count | bracketRonde | Round Name (French) | Teams |
|-------------|--------------|---------------------|-------|
| 32          | 1            | Trente-deuxièmes de finale | 64 |
| 16          | 2            | Seizièmes de finale | 32 |
| 8           | 3            | Huitièmes de finale | 16 |
| 4           | 4            | Quarts de finale | 8 |
| 2           | 5            | Demi-finales | 4 |
| 1 (but 2 matches) | 6   | Finales (Grande + Petite) | 2 |

## Tournament Structures by Team Count

### 4 Teams (Direct Semi-Finals)
- **Round 5**: Demi-finales (2 matches)
- **Round 6**: Finales (Grande + Petite)
- **Total**: 2 rounds

### 5-8 Teams
- **Round 4**: Quarts de finale (4 matches)
- **Round 5**: Demi-finales (2 matches)
- **Round 6**: Finales (Grande + Petite)
- **Total**: 3 rounds

### 9-16 Teams
- **Round 3**: Huitièmes de finale (8 matches)
- **Round 4**: Quarts de finale (4 matches)
- **Round 5**: Demi-finales (2 matches)
- **Round 6**: Finales (Grande + Petite)
- **Total**: 4 rounds

### 17-32 Teams (e.g., 26 teams)
- **Round 2**: Seizièmes de finale (16 matches)
- **Round 3**: Huitièmes de finale (8 matches)
- **Round 4**: Quarts de finale (4 matches)
- **Round 5**: Demi-finales (2 matches)
- **Round 6**: Finales (Grande + Petite)
- **Total**: 5 rounds

### 33-64 Teams
- **Round 1**: Trente-deuxièmes de finale (32 matches)
- **Round 2**: Seizièmes de finale (16 matches)
- **Round 3**: Huitièmes de finale (8 matches)
- **Round 4**: Quarts de finale (4 matches)
- **Round 5**: Demi-finales (2 matches)
- **Round 6**: Finales (Grande + Petite)
- **Total**: 6 rounds

## Implementation Details

### Backend (`parties.service.ts`)

```typescript
private calculateBracketRonde(matchCount: number): number {
  if (matchCount === 1) return 6;   // Finales
  if (matchCount === 2) return 5;   // Demi-finales
  if (matchCount === 4) return 4;   // Quarts
  if (matchCount === 8) return 3;   // Huitièmes
  if (matchCount === 16) return 2;  // Seizièmes
  return 1;  // 32+ matches = Trente-deuxièmes
}
```

### Frontend (`BracketView.tsx`)

**Key Functions:**
1. `calculateExpectedMatchesForRound()` - Returns expected match count for each bracketRonde
2. `calculateMaxBracketRonde()` - Determines total rounds based on first-round match count
3. `getRoundLabel()` - Provides French labels for each round

**Automatic Expansion:**
The system automatically expands to the next power of 2:
- 26 teams → 32 slots (5 rounds)
- 50 teams → 64 slots (6 rounds)
- Byes are created for empty slots (automatic 13-0 wins)

## Display Features

### Match Display
- ✅ Terrain assignment shown on each match (T1, T2, etc.)
- ✅ Team names appear as they qualify
- ✅ Placeholder matches show "À venir" for future rounds
- ✅ Status badges (À jouer, En cours, Terminée)

### Finale Display
- ✅ 🏆 **Grande Finale** - Championship match (bracketPos: 0)
- ✅ 🥉 **Petite Finale** - 3rd place match (bracketPos: 1)
- ✅ Both matches are in bracketRonde: 6

### Connection Lines
- ✅ Visual lines connect matches between rounds
- ✅ No connection lines on final round (round 6)

## Consolante Bracket

When enabled (`consolante: true`), a parallel bracket is created:
- **Created**: After Tour 1 completion
- **Participants**: Losers from Tour 1 of main bracket
- **Structure**: Same round system, separate from main bracket
- **Finals**: Has its own Grande and Petite finales

## Testing

To test different bracket sizes:

```bash
# 26 teams (5 rounds)
maxParticipants: 26

# 50 teams (6 rounds)
maxParticipants: 50

# 64 teams (6 rounds)
maxParticipants: 64
```

## Files Modified

- **Backend**: `backend/src/modules/parties/parties.service.ts`
  - Extended `calculateBracketRonde()` to support 6 rounds
  
- **Frontend**: `frontend/src/components/match/BracketView.tsx`
  - Updated `calculateExpectedMatchesForRound()` for 6 rounds
  - Updated `calculateMaxBracketRonde()` for 64 teams
  - Added "Trente-deuxièmes de finale" label
  - Updated all finale checks to bracketRonde: 6

## Limitations

- **Maximum**: 64 teams (can be extended further if needed)
- **Minimum**: 2 teams (direct finale)
- **Byes**: Automatically created when team count is not a power of 2

## Future Extensions

To support more teams (128, 256, etc.):
1. Add more cases to `calculateBracketRonde()`
2. Update `calculateMaxBracketRonde()` logic
3. Add French labels for additional rounds (64èmes, etc.)
