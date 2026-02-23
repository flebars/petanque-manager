# Login Credentials and Access Info

## Backend Status
✅ Backend is running on http://localhost:3000

## Test Account

### Email
```
organizer-coupe@test.com
```

### Password
```
Test123!
```

## Frontend Access
http://localhost:5173

## Existing Tournaments in Database

| Tournament Name | Format | Status | Teams |
|----------------|--------|--------|-------|
| Test Coupe 26 Équipes | COUPE | EN_COURS | 26 |
| Test Coupe 8 Équipes | COUPE | EN_COURS | 8 |
| Test Coupe 5 Équipes (Byes) | COUPE | EN_COURS | 5 |
| Test Coupe 4 Équipes | COUPE | EN_COURS | 4 |
| Grand Prix de Marseille 2026 | MELEE | EN_COURS | 8 |
| Tournoi Mêlée-Démêlée Test | MELEE | EN_COURS | 34 |
| Tournoi du Printemps - Triplette | MELEE | EN_COURS | 3 |
| Coupe de la Saint-Valentin 2026 | MELEE | TERMINE | 6 |
| Tournoi de st pierre | MELEE | INSCRIPTION | 1 |

## Direct Links

### Main Tournament (26 Teams - 5 Rounds)
http://localhost:5173/concours/d8467739-5395-47d8-8c8f-bb624eb180a4

### 8 Teams Tournament (3 Rounds)
http://localhost:5173/concours/7ed4c4db-a104-4f73-9466-41103f8f4f66

### 5 Teams Tournament (with Byes)
http://localhost:5173/concours/85ee670d-c847-42fe-b1f7-0acd78a81c9b

### 4 Teams Tournament (Direct Semi-Finals)
http://localhost:5173/concours/a8349110-a174-4566-bbb3-5195bcc3e193

## Troubleshooting

### If Login Doesn't Work

1. **Check Backend is Running**:
   ```bash
   curl http://localhost:3000/auth/login
   ```
   Should return: "Cannot POST /auth/login" (means backend is up)

2. **Test Login via API**:
   ```bash
   curl -X POST "http://localhost:3000/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "organizer-coupe@test.com", "password": "Test123!"}'
   ```
   Should return access and refresh tokens

3. **Check Frontend is Running**:
   ```bash
   cd /home/flb/workspace/petanque-manager/frontend
   npm run dev
   ```

### Creating a New Test Account

```bash
curl -X POST "http://localhost:3000/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test.com",
    "password": "Test123!",
    "nom": "Test",
    "prenom": "User",
    "genre": "H"
  }'
```

## Notes

⚠️ **Important**: Some older tournaments may have incorrect `bracketRonde` values due to the recent update from 5 rounds to 6 rounds. The "Test Coupe 26 Équipes" tournament may need to be recreated to see the correct 5-round structure.

The bracket system now supports:
- 2-4 teams: 2 rounds
- 5-8 teams: 3 rounds
- 9-16 teams: 4 rounds
- 17-32 teams: 5 rounds (like 26 teams)
- 33-64 teams: 6 rounds
