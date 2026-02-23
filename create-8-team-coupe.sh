#!/bin/bash

BASE_URL="http://localhost:3000"

echo "🎯 Creating 8-team COUPE tournament for testing..."

# 1. Register and login as organizer
echo "📝 Registering organizer..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer-8team@test.com",
    "password": "Test123!",
    "nom": "Organizer",
    "prenom": "8Team",
    "genre": "H"
  }')

echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer-8team@test.com",
    "password": "Test123!"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | sed 's/"accessToken":"//')

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to get access token"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo "✅ Logged in successfully"

# 2. Create 8 players
echo "👥 Creating 8 players..."
PLAYER_IDS=()

PLAYER_NAMES=("Alice" "Bob" "Charlie" "Diana" "Eve" "Frank" "Grace" "Henry")

for i in $(seq 0 7); do
  NAME=${PLAYER_NAMES[$i]}
  PLAYER_RESPONSE=$(curl -s -X POST "$BASE_URL/joueurs" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{
      \"email\": \"player${i}-8team@test.com\",
      \"nom\": \"Player\",
      \"prenom\": \"${NAME}\",
      \"genre\": \"H\"
    }")
  
  PLAYER_ID=$(echo $PLAYER_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')
  
  if [ -n "$PLAYER_ID" ]; then
    PLAYER_IDS+=("$PLAYER_ID")
    echo "  ✓ Created Player ${NAME}: $PLAYER_ID"
  else
    echo "  ⚠ Failed to create Player ${NAME}: $PLAYER_RESPONSE"
  fi
done

echo "✅ Created ${#PLAYER_IDS[@]} players"

# 3. Create tournament (COUPE format, MONTEE constitution, 8 max participants, 3 terrains, with consolante)
echo "🏆 Creating COUPE tournament..."
CONCOURS_RESPONSE=$(curl -s -X POST "$BASE_URL/concours" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "nom": "Test Coupe 8 Teams",
    "format": "COUPE",
    "typeEquipe": "TETE_A_TETE",
    "modeConstitution": "MONTEE",
    "nbTerrains": 3,
    "dateDebut": "2026-03-15T09:00:00.000Z",
    "dateFin": "2026-03-15T18:00:00.000Z",
    "lieu": "Boulodrome Test",
    "maxParticipants": 8,
    "consolante": true
  }')

CONCOURS_ID=$(echo $CONCOURS_RESPONSE | grep -o '"id":"[^"]*' | sed 's/"id":"//')

if [ -z "$CONCOURS_ID" ]; then
  echo "❌ Failed to create tournament"
  echo "Response: $CONCOURS_RESPONSE"
  exit 1
fi

echo "✅ Created tournament: $CONCOURS_ID"

# 4. Register all 8 players as individual teams
echo "📋 Registering 8 teams..."

for i in $(seq 0 7); do
  PLAYER_ID=${PLAYER_IDS[$i]}
  NAME=${PLAYER_NAMES[$i]}
  
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
      echo "  ✓ Registered Team ${NAME} (${EQUIPE_ID})"
    else
      echo "  ⚠ Failed to register Team ${NAME}"
    fi
  fi
done

echo ""
echo "✅ Tournament setup complete!"
echo ""
echo "📊 Summary:"
echo "  - Tournament ID: $CONCOURS_ID"
echo "  - Teams registered: 8"
echo "  - Terrains: 3"
echo "  - Format: COUPE with Consolante"
echo "  - Type: TETE_A_TETE"
echo ""
echo "🌐 View in browser:"
echo "  http://localhost:5173/concours/$CONCOURS_ID"
echo ""
echo "📝 Login credentials:"
echo "  Email: organizer-8team@test.com"
echo "  Password: Test123!"
echo ""
echo "⚠️  Tournament is NOT launched yet - you can launch it from the UI"
