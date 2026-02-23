#!/bin/bash

BASE_URL="http://localhost:3000"

echo "🎯 Creating test tournament with 26 teams..."

# 1. Register and login as organizer
echo "📝 Registering organizer..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer-coupe@test.com",
    "password": "Test123!",
    "nom": "Organizer",
    "prenom": "Coupe",
    "genre": "H"
  }')

echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer-coupe@test.com",
    "password": "Test123!"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get access token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Logged in successfully"

# 2. Create 26 players
echo "👥 Creating 26 players..."
PLAYER_IDS=()

for i in $(seq 1 26); do
  PLAYER_RESPONSE=$(curl -s -X POST "$BASE_URL/joueurs" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"email\": \"player${i}-coupe@test.com\",
      \"nom\": \"Joueur\",
      \"prenom\": \"${i}\",
      \"genre\": \"H\"
    }")
  
  PLAYER_ID=$(echo $PLAYER_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')
  
  if [ -n "$PLAYER_ID" ]; then
    PLAYER_IDS+=("$PLAYER_ID")
    echo "  ✓ Created Player $i: $PLAYER_ID"
  else
    echo "  ⚠ Failed to create Player $i: $PLAYER_RESPONSE"
  fi
done

echo "✅ Created ${#PLAYER_IDS[@]} players"

# 3. Create tournament (COUPE format, MONTEE constitution, 26 max participants, 4 terrains)
echo "🏆 Creating COUPE tournament..."
CONCOURS_RESPONSE=$(curl -s -X POST "$BASE_URL/concours" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nom": "Test Coupe 26 Équipes",
    "format": "COUPE",
    "typeEquipe": "TETE_A_TETE",
    "modeConstitution": "MONTEE",
    "nbTerrains": 4,
    "dateDebut": "2026-03-01T09:00:00.000Z",
    "dateFin": "2026-03-01T18:00:00.000Z",
    "lieu": "Boulodrome Test",
    "maxParticipants": 26,
    "consolante": true
  }')

CONCOURS_ID=$(echo $CONCOURS_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')

if [ -z "$CONCOURS_ID" ]; then
  echo "❌ Failed to create tournament"
  echo "Response: $CONCOURS_RESPONSE"
  exit 1
fi

echo "✅ Created tournament: $CONCOURS_ID"

# 4. Register all 26 players as individual teams
echo "📋 Registering 26 teams..."

for i in $(seq 0 25); do
  PLAYER_ID=${PLAYER_IDS[$i]}
  
  if [ -n "$PLAYER_ID" ]; then
    EQUIPE_RESPONSE=$(curl -s -X POST "$BASE_URL/equipes" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer $TOKEN" \
      -d "{
        \"concoursId\": \"$CONCOURS_ID\",
        \"joueurIds\": [\"$PLAYER_ID\"]
      }")
    
    EQUIPE_ID=$(echo $EQUIPE_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')
    
    if [ -n "$EQUIPE_ID" ]; then
      echo "  ✓ Registered Team $((i+1))"
    else
      echo "  ⚠ Failed to register Team $((i+1))"
    fi
  fi
done

echo ""
echo "✅ Tournament setup complete!"
echo ""
echo "📊 Summary:"
echo "  - Tournament ID: $CONCOURS_ID"
echo "  - Teams registered: 26"
echo "  - Terrains: 4"
echo "  - Format: COUPE with Consolante"
echo "  - Type: TETE_A_TETE"
echo ""
echo "🌐 View in browser:"
echo "  http://localhost:5173/concours/$CONCOURS_ID"
echo ""
echo "⚠️  Tournament is NOT launched yet - you can launch it from the UI"
