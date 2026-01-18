#!/bin/bash
# Test script for Story Engine endpoints

BASE_URL="http://127.0.0.1:5002"
ERRORS=0
TESTS=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

test_endpoint() {
    local name="$1"
    local method="$2"
    local endpoint="$3"
    local data="$4"
    local expected_status="$5"

    TESTS=$((TESTS + 1))

    if [ "$method" == "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" -H "Content-Type: application/json" -d "$data")
    fi

    status=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')

    if [ "$status" == "$expected_status" ]; then
        echo -e "${GREEN}[PASS]${NC} $name (HTTP $status)"
        echo "$body" | python3 -m json.tool 2>/dev/null | head -5
    else
        echo -e "${RED}[FAIL]${NC} $name - Expected $expected_status, got $status"
        echo "$body" | head -10
        ERRORS=$((ERRORS + 1))
    fi
    echo ""
}

echo "=========================================="
echo "  STORY ENGINE - PRUEBAS DE ENDPOINTS"
echo "=========================================="
echo ""

# 1. Health check
echo "--- Health & Basic ---"
test_endpoint "Health Check" "GET" "/health" "" "200"

# 2. Campaigns
echo "--- Campaigns ---"
test_endpoint "List Campaigns" "GET" "/campaigns" "" "200"

# 3. Analyze Action
echo "--- Analyze Action ---"
test_endpoint "Analyze Dialogue" "POST" "/analyze-action" \
    '{"room_id": 1, "user_id": 1, "username": "test", "message": "Hablo con el tabernero"}' "200"

test_endpoint "Analyze Combat" "POST" "/analyze-action" \
    '{"room_id": 1, "user_id": 1, "username": "test", "message": "Ataco al guardia con mi espada"}' "200"

test_endpoint "Analyze Stealth" "POST" "/analyze-action" \
    '{"room_id": 1, "user_id": 1, "username": "test", "message": "Me escondo en las sombras"}' "200"

test_endpoint "Analyze Karma Action" "POST" "/analyze-action" \
    '{"room_id": 1, "user_id": 1, "username": "test", "message": "Ayudo al mendigo dandole unas monedas"}' "200"

# 4. Story State (sin room - debe dar 404)
echo "--- Story State ---"
test_endpoint "Get Story State (no room)" "GET" "/story-state/999" "" "404"

# 5. Initialize Progress (room no existe - debe dar 404)
echo "--- Initialize Progress ---"
test_endpoint "Initialize Progress (no room)" "POST" "/initialize-progress" \
    '{"room_id": 999, "campaign_id": 2}' "404"

# 6. Get Context (sin progreso - debe dar 404)
echo "--- AI Context ---"
test_endpoint "Get AI Context (no progress)" "GET" "/ai-context/999" "" "404"

# 7. NPC Reaction (sin progreso - debe dar 404)
echo "--- NPC Reaction ---"
test_endpoint "NPC Reaction (no progress)" "POST" "/npc-reaction" \
    '{"room_id": 999, "npc_code": "varen", "action_type": "dialogue", "action_details": {"topic": "principe"}}' "404"

# 8. Calculate Ending (sin progreso - debe dar 404)
echo "--- Calculate Ending ---"
test_endpoint "Calculate Ending (no progress)" "GET" "/calculate-ending/999" "" "404"

# 9. Process Decision (sin progreso - debe dar 404)
echo "--- Process Decision ---"
test_endpoint "Process Decision (no progress)" "POST" "/process-decision" \
    '{"room_id": 999, "decision_code": "trust_varen", "chosen_option": "trust"}' "404"

# 10. Invalid requests
echo "--- Error Handling ---"
test_endpoint "Invalid Campaign" "POST" "/initialize-progress" \
    '{"room_id": 1, "campaign_id": 9999}' "404"

test_endpoint "Missing Fields" "POST" "/analyze-action" \
    '{"room_id": 1}' "422"

echo "=========================================="
echo "  RESUMEN"
echo "=========================================="
echo "Tests ejecutados: $TESTS"
echo -e "Errores: ${RED}$ERRORS${NC}"

if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Todos los tests pasaron!${NC}"
else
    echo -e "${YELLOW}Hay $ERRORS tests que fallaron${NC}"
fi
