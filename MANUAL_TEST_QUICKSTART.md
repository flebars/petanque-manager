# 🚀 Quick Start - Manual Testing CHAMPIONNAT Format

## ✅ Everything is Ready!

The application is now running with test data loaded. You can start manual testing immediately!

---

## 🔐 Login Credentials

```
Email: organizer@test.com
Password: test123
```

---

## 🌐 Application URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **Health Check**: http://localhost:3000/health

---

## 📋 Test Tournaments Available

### 1️⃣  TEST CHAMP 1 - Ready for Pools

**Status**: Teams registered, ready to launch pool phase  
**Teams**: 12 teams (will create 3 pools of 4)  
**Terrains**: 4

**What to Test**:
1. Login to the app
2. Navigate to "Concours" (Tournaments)
3. Open "TEST CHAMP 1 - Ready for Pools"
4. Go to "Parties" (Matches) tab
5. Click **"Lancer les Poules"** button
6. ✅ Verify 3 pools created
7. ✅ Verify 18 matches generated (6 per pool)
8. ✅ Verify pool rankings displayed

---

### 2️⃣  TEST CHAMP 2 - Pools In Progress

**Status**: Pool matches partially completed  
**Teams**: 8 teams in 2 pools  
**Progress**: 6/12 matches completed

**What to Test**:
1. Open "TEST CHAMP 2 - Pools In Progress"
2. View pool rankings (partially updated)
3. Select a match with status "EN_COURS"
4. Click "Saisir le Score" (Enter Score)
5. Enter scores: e.g., Team A: 13, Team B: 7
6. ✅ Verify ranking updates immediately
7. Complete all remaining matches
8. ✅ Verify "Lancer la Phase Finale" button appears

---

### 3️⃣  TEST CHAMP 3 - Ready for Bracket

**Status**: All pool matches completed, ready for bracket  
**Teams**: 8 teams (4 will qualify)  
**Pool Matches**: 12 (all completed)

**What to Test**:
1. Open "TEST CHAMP 3 - Ready for Bracket"
2. View final pool rankings
3. Note the top 2 teams from each pool
4. Click **"Lancer la Phase Finale"** button
5. ✅ Verify bracket view appears
6. ✅ Verify 4 qualified teams (2 from each pool)
7. ✅ Verify 2 semi-final matches created
8. ✅ Verify no byes (4 teams = perfect power of 2)

---

### 4️⃣  TEST CHAMP 4 - Bracket In Progress

**Status**: Bracket started, semi-finals in progress  
**Teams**: 4 qualified teams  
**Bracket**: 1 semi-final done, 1 in progress

**What to Test**:
1. Open "TEST CHAMP 4 - Bracket In Progress"
2. View bracket visualization
3. See completed semi-final 1
4. Complete semi-final 2:
   - Enter score for the in-progress match
   - Click validate
5. ✅ Verify final match created automatically
6. ✅ Verify both winners progressed to final
7. Complete the final match
8. ✅ Verify tournament completion
9. ✅ Verify final rankings/podium

---

## 🎯 Key Features to Test

### Pool Phase
- [ ] Pool generation (correct distribution)
- [ ] Round-robin matches (all-vs-all)
- [ ] Terrain assignment (rotation)
- [ ] Ranking calculation (Wins → Quotient → Points)
- [ ] Quotient formula: `points_scored / points_conceded`
- [ ] Real-time ranking updates
- [ ] Phase completion detection

### Bracket Phase
- [ ] Qualification (top 2 per pool)
- [ ] Global ranking (across all pools)
- [ ] Bye assignment (highest ranked)
- [ ] No adjacent byes
- [ ] Automatic winner progression
- [ ] Semi-finals → Final flow
- [ ] Bracket visualization

### Edge Cases
- [ ] Score validation (winner must have 13)
- [ ] Concurrent operation prevention
- [ ] Forfeit handling
- [ ] Tie-breaking (quotient, then points)

---

## 🔄 Reset Test Data

To reset and recreate test data:

```bash
cd backend

# Method 1: Run seed script again (cleans old data automatically)
DATABASE_URL="postgresql://petanque:petanque@localhost:5432/petanque" \
  npx ts-node --compiler-options '{"module":"commonjs"}' \
  prisma/seed-championnat-test.ts

# Method 2: Clean all test data manually
PGPASSWORD=petanque psql -h localhost -U petanque -d petanque -c \
  "DELETE FROM concours WHERE nom LIKE 'TEST CHAMP%';"
```

---

## 🐛 Troubleshooting

### Login Error "Internal Server Error"

**Cause**: Backend not running or Redis not accessible

**Solution**:
```bash
# Kill any existing backend processes
pkill -f "ts-node-dev.*src/main.ts"

# Restart with correct environment
cd backend
DATABASE_URL="postgresql://petanque:petanque@localhost:5432/petanque" \
  REDIS_URL="redis://localhost:6379" \
  JWT_SECRET="test_jwt_secret_min_32_characters_long" \
  JWT_REFRESH_SECRET="test_refresh_secret_min_32_chars" \
  npm run start:dev
```

### Frontend Not Loading

**Solution**:
```bash
cd frontend
VITE_API_URL="http://localhost:3000" \
  VITE_WS_URL="http://localhost:3000" \
  npm run dev
```

### Database Connection Failed

**Solution**:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not running, start docker-compose services
cd /home/flb/workspace/petanque-manager
docker-compose up -d postgres redis
```

### No Tournaments Showing

**Solution**:
```bash
# Re-run the seed script
cd backend
DATABASE_URL="postgresql://petanque:petanque@localhost:5432/petanque" \
  npx ts-node --compiler-options '{"module":"commonjs"}' \
  prisma/seed-championnat-test.ts
```

---

## 📊 Verify Data in Database

Check tournaments:
```bash
PGPASSWORD=petanque psql -h localhost -U petanque -d petanque -c \
  "SELECT nom, format, statut FROM concours WHERE nom LIKE 'TEST CHAMP%' ORDER BY nom;"
```

Check pools and matches:
```bash
PGPASSWORD=petanque psql -h localhost -U petanque -d petanque -c \
  "SELECT c.nom, COUNT(DISTINCT p.id) as pools, COUNT(pa.id) as matches 
   FROM concours c 
   LEFT JOIN poules p ON p.\"concoursId\" = c.id 
   LEFT JOIN parties pa ON pa.\"concoursId\" = c.id 
   WHERE c.nom LIKE 'TEST CHAMP%' 
   GROUP BY c.nom ORDER BY c.nom;"
```

---

## ✨ Happy Testing!

All 4 test scenarios are ready. Follow the testing guide in each stage section above to systematically test the entire CHAMPIONNAT tournament lifecycle.

**Need Help?**
- Check backend logs: `tail -f /tmp/backend.log`
- Check frontend logs: `tail -f /tmp/frontend.log`
- Review main documentation: `CHAMPIONNAT_MANUAL_TEST.md`

🎾 **Bonne chance!**
