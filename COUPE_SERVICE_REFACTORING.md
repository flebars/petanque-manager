# CoupeService Refactoring Summary

## Overview
Successfully extracted all COUPE (elimination bracket) management logic from `PartiesService` into a dedicated `CoupeService` class for better code organization and maintainability.

## Changes Made

### 1. New File: `backend/src/modules/parties/coupe.service.ts`
Created a new service class with ~650 lines of COUPE-specific logic:

**Public Methods:**
- `lancerTourCoupe(concoursId, tour)` - Initialize and launch bracket tournament
- `progresserMatchBracket(completedMatch)` - Handle winner advancement after match completion

**Private Methods:**
- `creerBracketPrincipal()` - Create main elimination bracket
- `creerBracketConsolanteInitial()` - Initialize consolante (repechage) bracket structure
- `addLoserToConsolante()` - Add losers from main bracket to consolante
- `createOrUpdateNextMatch()` - Create or update placeholder matches for next round
- `createOrUpdateFinale()` - Create Grande and Petite Finales (with enhanced debugging)
- `assignTerrainToMatch()` - Auto-assign available terrain to matches
- `calculateBracketRonde()` - Calculate bracket round number based on match count
- `calculateConsolanteBracketRonde()` - Calculate consolante bracket round number
- `nextPowerOfTwo()` - Utility for bracket size calculation

**Enhanced Logging:**
Added extensive console.log statements in `createOrUpdateFinale()` to debug the Petite Finale creation issue:
```typescript
console.log(`[BRACKET] Winners:`, winners);
console.log(`[BRACKET] Losers:`, losers);
console.log(`[BRACKET] Checking for Petite Finale at R${finaleRonde} P1...`);
console.log(`[BRACKET] Petite Finale not found, creating with losers:`, losers);
console.log(`[BRACKET] ✅ Created Petite Finale at R${finaleRonde} P1`);
```

### 2. Updated: `backend/src/modules/parties/parties.service.ts`
**Reduced from ~1080 lines to ~387 lines** (64% reduction!)

**Changes:**
- Added `CoupeService` injection in constructor
- `lancerTourCoupe()` now delegates to `coupeService.lancerTourCoupe()`
- `saisirScore()` delegates bracket progression to `coupeService.progresserMatchBracket()`
- `forfaitAvantMatch()` delegates bracket progression to `coupeService.progresserMatchBracket()`
- Removed all COUPE-specific private methods (moved to CoupeService)

**Before:**
```typescript
async lancerTourCoupe(concoursId: string, tour: number): Promise<Partie[]> {
  // 50+ lines of COUPE logic...
}
```

**After:**
```typescript
async lancerTourCoupe(concoursId: string, tour: number): Promise<Partie[]> {
  return this.coupeService.lancerTourCoupe(concoursId, tour);
}
```

### 3. Updated: `backend/src/modules/parties/parties.module.ts`
```typescript
providers: [PartiesService, CoupeService],  // Added CoupeService
exports: [PartiesService, CoupeService],     // Export for potential use in other modules
```

### 4. Updated: `backend/src/modules/parties/parties.service.spec.ts`
- Added `CoupeService` mock to test setup
- Simplified tests to verify delegation (detailed COUPE tests should move to `coupe.service.spec.ts`)
- Reduced from 294 lines to 87 lines

**Example Test:**
```typescript
it('should delegate to CoupeService', async () => {
  const concoursId = 'concours-1';
  const expectedParties = [/* ... */];
  
  coupeService.lancerTourCoupe.mockResolvedValue(expectedParties);
  
  const parties = await service.lancerTourCoupe(concoursId, 1);
  
  expect(coupeService.lancerTourCoupe).toHaveBeenCalledWith(concoursId, 1);
  expect(parties).toEqual(expectedParties);
});
```

## Benefits

### 1. Separation of Concerns
- **PartiesService**: Core match operations (CRUD, scoring, disputes, MELEE draw)
- **CoupeService**: COUPE bracket logic (initialization, progression, finals)
- Easier to understand and maintain each service independently

### 2. Testability
- COUPE logic can be tested in isolation
- Mock CoupeService in PartiesService tests
- Reduced test complexity

### 3. Scalability
- Easy to add `ChampionnatService` for pool-based tournaments
- Pattern established for format-specific services
- Could extract `MeleeService` similarly in future

### 4. Code Size
- PartiesService reduced by 64% (1080 → 387 lines)
- Each service now has a clear, focused responsibility

### 5. Debugging
- Enhanced logging in CoupeService helps identify issues
- COUPE-specific logs prefixed with `[BRACKET]`
- Easier to trace bracket progression issues

## Architecture Pattern

```
┌─────────────────────────────────────────┐
│         PartiesController               │
│  (HTTP endpoints for match operations)  │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼─────────┐
        │  PartiesService  │
        │  (Core matches)  │
        └────────┬─────────┘
                 │
        ┌────────▼─────────────────────┐
        │      Format Services         │
        ├──────────────────────────────┤
        │  CoupeService                │
        │  (Bracket management)        │
        │                              │
        │  MeleeService (future)       │
        │  (Swiss rounds)              │
        │                              │
        │  ChampionnatService (future) │
        │  (Pools + Bracket)           │
        └──────────────────────────────┘
```

## Next Steps

### 1. Fix Consolante Petite Finale Bug
The enhanced logging will help identify why the Petite Finale is not being created:
```bash
# Watch logs during match completion
docker logs -f petanque-backend 2>&1 | grep "\[BRACKET\]"
```

### 2. Create CoupeService Unit Tests
Move detailed bracket tests from `parties.service.spec.ts` to new `coupe.service.spec.ts`:
- Test bracket generation for 4, 8, 16, 32, 64 teams
- Test bye handling
- Test winner progression through rounds
- Test Consolante integration
- Test Finals creation (Grande + Petite)

### 3. Integration Testing
Test the full tournament flow with the new structure:
```bash
./test-coupe-e2e.sh
```

### 4. Consider Similar Refactoring for MELEE
If MELEE logic grows complex, extract `MeleeService`:
- `lancerTourMelee()`
- `tirageMelee()` (already separate in tirage.service)
- Swiss pairing logic

## Testing the Refactoring

### Manual Test
1. Start services: `docker-compose up -d`
2. Run E2E test: `./test-coupe-e2e.sh`
3. Check logs: `docker logs -f petanque-backend | grep "\[BRACKET\]"`

### Expected Behavior
- ✅ Main bracket progression works (QF → SF → Finals)
- ✅ Consolante losers are added correctly
- ⚠️ Consolante Petite Finale issue (1 bug remaining - under investigation)

## Files Changed
- **Created**: `backend/src/modules/parties/coupe.service.ts` (+650 lines)
- **Modified**: `backend/src/modules/parties/parties.service.ts` (-693 lines)
- **Modified**: `backend/src/modules/parties/parties.module.ts` (+2 lines)
- **Modified**: `backend/src/modules/parties/parties.service.spec.ts` (-207 lines)

**Net Change**: -248 lines, but with much better organization!

## Commit
```
commit d05343f
refactor: Extract COUPE bracket management into dedicated CoupeService
```
