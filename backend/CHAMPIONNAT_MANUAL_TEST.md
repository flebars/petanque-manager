# 🎯 CHAMPIONNAT Manual Testing Guide

## Quick Start

### 1. Run the Seed Script

```bash
cd backend
DATABASE_URL="postgresql://petanque:petanque@localhost:5432/petanque" \
  npx ts-node --compiler-options '{"module":"commonjs"}' \
  prisma/seed-championnat-test.ts
```

### 2. Login Credentials

```
Email: organizer@test.com
Password: test123
```

### 3. Access the Application

Navigate to: **http://localhost:5173/concours**

---

## 📋 Test Scenarios

The seed script creates 4 tournaments at different stages of the CHAMPIONNAT flow:

### 🏁 Stage 1: Ready to Launch Pools

**Tournament**: `TEST CHAMP 1 - Ready for Pools`

**Setup**:
- ✅ 12 teams registered
- ✅ 4 terrains configured
- ✅ Tournament status: EN_COURS

**Test Actions**:
1. Open the tournament
2. Navigate to "Parties" tab
3. Click **"Lancer les Poules"** button
4. Verify:
   - ✅ 3 pools created (4 teams each)
   - ✅ 18 total matches generated (6 per pool)
   - ✅ Each match assigned to a terrain
   - ✅ All matches in status "A_JOUER"
   - ✅ Pool rankings visible (all at 0-0)

**Expected Result**: Pool phase launched successfully

---

### ⚽ Stage 2: Pools In Progress

**Tournament**: `TEST CHAMP 2 - Pools In Progress`

**Setup**:
- ✅ 2 pools of 4 teams
- ✅ Some matches completed (3/6 per pool)
- ✅ Some matches in progress (3/6 per pool)

**Test Actions**:
1. Open the tournament → "Parties" tab
2. View pool rankings (partially updated)
3. Select a match "EN_COURS"
4. Click **"Saisir le Score"**
5. Enter scores (winner must have 13)
6. Validate
7. Verify:
   - ✅ Match status → TERMINEE
   - ✅ Pool rankings updated
   - ✅ Wins/quotient/points calculated correctly
8. Complete ALL remaining matches
9. Verify:
   - ✅ "Lancer la Phase Finale" button appears
   - ✅ All matches show TERMINEE status

**Expected Result**: Pool rankings calculated correctly

---

### 🏆 Stage 3: Ready for Bracket

**Tournament**: `TEST CHAMP 3 - Ready for Bracket`

**Setup**:
- ✅ 2 pools of 4 teams
- ✅ ALL pool matches completed
- ✅ Final pool rankings calculated

**Test Actions**:
1. Open tournament → "Parties" tab
2. View final pool rankings
3. Identify top 2 from each pool (4 total qualified)
4. Click **"Lancer la Phase Finale"** button
5. Verify:
   - ✅ Pools marked as "TERMINE"
   - ✅ 2 bracket matches created (semi-finals)
   - ✅ Top 2 teams from each pool qualified
   - ✅ Teams ranked globally (highest ranked get byes if needed)
   - ✅ Bracket view appears
   - ✅ Matches assigned to terrains

**Expected Result**: Bracket phase launched with correct qualifiers

---

### 🥇 Stage 4: Bracket In Progress

**Tournament**: `TEST CHAMP 4 - Bracket In Progress`

**Setup**:
- ✅ Pools phase completed
- ✅ Bracket phase active
- ✅ Semi-final 1: TERMINEE
- ✅ Semi-final 2: EN_COURS

**Test Actions**:
1. Open tournament → "Parties" tab
2. Switch to bracket view
3. View completed semi-final 1 (winner qualified)
4. Complete semi-final 2:
   - Click match → "Saisir le Score"
   - Enter score (winner: 13 points)
   - Validate
5. Verify:
   - ✅ Final match created automatically
   - ✅ Both semi-final winners in final
   - ✅ Final match appears in bracket
6. Complete the final:
   - Enter final score
   - Validate
7. Verify:
   - ✅ Tournament winner determined
   - ✅ Final rankings displayed
   - ✅ Podium shown (if implemented)

**Expected Result**: Complete bracket flow with automatic progression

---

## 🧪 Test Checklist

### Pool Phase Tests

- [ ] Launch pools with correct distribution (12 teams → 3 pools of 4)
- [ ] Round-robin matches generated (C(n,2) = n(n-1)/2 per pool)
- [ ] Terrains assigned in rotation
- [ ] Rankings update after each match
- [ ] Ranking order: Wins → Quotient → Points scored
- [ ] Quotient calculation: points_scored / points_conceded
- [ ] Handle divide-by-zero (0 conceded = quotient = scored)
- [ ] "Lancer Phase Finale" button only appears when ALL pool matches done

### Bracket Phase Tests

- [ ] Top 2 from each pool qualify
- [ ] Teams ranked globally across all pools
- [ ] Byes assigned to highest-ranked teams (if non-power-of-2)
- [ ] No adjacent byes in bracket
- [ ] Bye matches auto-complete (13-0)
- [ ] Winner progression automatic
- [ ] Final match created when semi-finals complete
- [ ] Bracket visualization correct

### Edge Cases

- [ ] Concurrent pool launch prevented (Redis lock)
- [ ] Concurrent bracket launch prevented (Redis lock)
- [ ] Cannot launch bracket with incomplete pool matches
- [ ] Forfeit handled correctly (13-0)
- [ ] Tie-breaking: wins equal → use quotient
- [ ] Quotient tie → use points scored

---

## 🔧 Troubleshooting

### Seed Script Fails

**Issue**: "Authentication failed"
```bash
# Solution: Use correct DATABASE_URL
DATABASE_URL="postgresql://petanque:petanque@localhost:5432/petanque" \
  npx ts-node --compiler-options '{"module":"commonjs"}' \
  prisma/seed-championnat-test.ts
```

**Issue**: "Table does not exist"
```bash
# Solution: Apply schema first
cd backend
DATABASE_URL="postgresql://petanque:petanque@localhost:5432/petanque" \
  npx prisma db push
```

### Re-run Seed

The seed script automatically cleans up existing test data before creating new data:

```bash
# Safe to run multiple times
cd backend
DATABASE_URL="postgresql://petanque:petanque@localhost:5432/petanque" \
  npx ts-node --compiler-options '{"module":"commonjs"}' \
  prisma/seed-championnat-test.ts
```

---

## 📊 Verification Queries

Check created tournaments:
```sql
SELECT nom, format, statut, 
  (SELECT COUNT(*) FROM equipes WHERE equipes."concoursId" = concours.id) as teams
FROM concours 
WHERE nom LIKE 'TEST CHAMP%' 
ORDER BY nom;
```

Check pools and matches:
```sql
SELECT c.nom, 
  COUNT(DISTINCT p.id) as pools, 
  COUNT(DISTINCT pa.id) as matches
FROM concours c
LEFT JOIN poules p ON p."concoursId" = c.id
LEFT JOIN parties pa ON pa."concoursId" = c.id
WHERE c.nom LIKE 'TEST CHAMP%'
GROUP BY c.nom
ORDER BY c.nom;
```

---

## 🎓 Expected Database State

| Tournament | Pools | Matches | Status |
|------------|-------|---------|--------|
| Stage 1 | 0 | 0 | Ready to launch pools |
| Stage 2 | 2 | 12 | 6 completed, 6 in progress |
| Stage 3 | 2 | 12 | All pool matches completed |
| Stage 4 | 2 | 14 | 12 pool + 2 bracket (1 done, 1 in progress) |

---

## 📝 Notes

- All test tournaments use **CHAMPIONNAT** format
- Pool size configured: **4 teams per pool** (customizable in params)
- Default terrain count: **2-4 terrains** per tournament
- Match scoring: **Winner must have exactly 13 points**
- Ranking priority: **Wins > Quotient > Points Scored**

---

## 🚀 Next Steps After Manual Testing

1. ✅ Verify pool generation algorithm
2. ✅ Test ranking calculations (wins, quotient, points)
3. ✅ Validate qualification logic (top 2 per pool)
4. ✅ Test bracket generation with byes
5. ✅ Verify automatic winner progression
6. ✅ Test Redis lock for concurrent operations
7. ✅ Validate WebSocket event emissions
8. 📱 Test on mobile devices
9. 🎨 UI/UX feedback
10. 🐛 Report any bugs found

**Happy Testing! 🎾**
