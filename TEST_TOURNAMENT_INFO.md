# Test Tournament Created ✅

## Tournament Details

- **ID**: `d8467739-5395-47d8-8c8f-bb624eb180a4`
- **Name**: Test Coupe 26 Équipes
- **Format**: COUPE (Elimination Bracket)
- **Type**: TETE_A_TETE (1v1)
- **Status**: INSCRIPTION (Not launched yet)
- **Teams Registered**: 26 teams
- **Terrains**: 4
- **Consolante**: Enabled (losers bracket)

## Access

### Web Interface
- **URL**: http://localhost:5173/concours/d8467739-5395-47d8-8c8f-bb624eb180a4
- **Login**: organizer-coupe@test.com / Test123!

### API
- **Base URL**: http://localhost:3000
- **Tournament endpoint**: GET /concours/d8467739-5395-47d8-8c8f-bb624eb180a4

## Expected Bracket Structure

With 26 teams, the bracket will expand to 32 slots (next power of 2):
- **Tour 1**: 16 matches (includes 6 byes for automatic advancement)
- **Tour 2**: 8 matches (1/8 finals)
- **Tour 3**: 4 matches (1/4 finals - Quarts de finale)
- **Tour 4**: 2 matches (Demi-finales)
- **Tour 5**: 2 matches (Grande Finale + Petite Finale)

### Consolante Bracket
After Tour 1, the 16 losers from the main bracket will create a consolante bracket:
- Consolante structure: 16 → 8 → 4 → 2 → 1 (finale)

## Next Steps

1. Open the web interface at http://localhost:5173
2. Login with: organizer-coupe@test.com / Test123!
3. Navigate to the tournament detail page
4. Click "Démarrer" (Start) button to move to EN_COURS status
5. Click "Lancer Tableau" to launch Tour 1 and create the bracket
6. The bracket view will display the complete structure with:
   - Real matches in Tour 1
   - Placeholder "À venir" slots for future rounds
   - 6 byes will be marked as completed (13-0)

## Testing the Bracket View

Once launched, you should see:
- ✅ Complete bracket structure from Tour 1 to Finales
- ✅ Team names in Tour 1 matches
- ✅ "À venir" placeholders in future rounds
- ✅ Terrain assignments (T1, T2, T3, T4) displayed on each match
- ✅ Grande Finale and Petite Finale labels
- ✅ Consolante bracket in separate section (after Tour 1 completes)

## Cleanup

To delete this test tournament and start fresh, run:
```bash
# Via API (requires authentication)
curl -X DELETE http://localhost:3000/concours/d8467739-5395-47d8-8c8f-bb624eb180a4 \
  -H "Authorization: Bearer YOUR_TOKEN"
```
