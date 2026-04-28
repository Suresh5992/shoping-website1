#!/bin/bash

NAMESPACE="shopping"
SERVICE_NAME="api"
LOCAL_PORT=3000
REMOTE_PORT=3000

API_HOST="localhost"
API_PORT="$LOCAL_PORT"
BASE_URL="http://$API_HOST:$API_PORT/api"

LOG_FILE="transactions.log"

echo "🚀 Starting port-forward..."

# Kill existing port-forward if running

pkill -f "kubectl port-forward svc/$SERVICE_NAME" 2>/dev/null

# Start port-forward in background

kubectl port-forward svc/$SERVICE_NAME $LOCAL_PORT:$REMOTE_PORT -n $NAMESPACE >/dev/null 2>&1 &
PF_PID=$!

# Wait for port to be ready

sleep 3

echo "🔍 Checking API connectivity at $BASE_URL..."

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL")

if [ "$STATUS" != "200" ] && [ "$STATUS" != "404" ]; then
echo "❌ Cannot reach API at $BASE_URL (status: $STATUS)"
echo "👉 Port-forward may have failed"
kill $PF_PID
exit 1
fi

echo "✅ API reachable. Starting transactions..."

names=(Alice Bob Carol Dave Eve Frank Grace Harry Iris Jack)
products=("Smartphone" "Headphones" "Laptop" "Coffee Maker" "Running Shoes" "Backpack" "Wireless Mouse" "Keyboard" "Desk Lamp" "Water Bottle")

random_item() {
local arr=("${!1}")
echo "${arr[$RANDOM % ${#arr[@]}]}"
}

# Cleanup on exit

cleanup() {
echo "🛑 Stopping port-forward..."
kill $PF_PID 2>/dev/null
}
trap cleanup EXIT

while true
do
first_name=$(random_item names[@])
product=$(random_item products[@])
mobile="7$(printf '%09d' $((RANDOM * RANDOM % 1000000000)))"
email="${first_name,,}$((RANDOM % 1000))@gmail.com"
order_id="txn-$((RANDOM))-$((SECONDS))"
quantity=$(( (RANDOM % 5) + 1 ))
price=$(( (RANDOM % 90) + 10 ))
amount=$(( quantity * price ))

echo "🚀 Starting transaction: $order_id" | tee -a $LOG_FILE

RESPONSE=$(curl -sS --max-time 5 -X POST "$BASE_URL/send-otp" 
-H "Content-Type: application/json" 
-d "{"mobile":"$mobile"}")

if [ -z "$RESPONSE" ]; then
echo "❌ Empty response. Skipping..." | tee -a $LOG_FILE
continue
fi

OTP=$(echo "$RESPONSE" | sed -n 's/.*"demoOtp":"([0-9]*)".*/\1/p')

if [ -z "$OTP" ]; then
echo "❌ OTP parse failed. Skipping..." | tee -a $LOG_FILE
continue
fi

sleep 2

ORDER_JSON=$(cat <<EOF
{"id":"$order_id","customer":{"name":"$first_name","email":"$email","mobile":"$mobile"},"items":[{"product":"$product","quantity":$quantity,"price":$price}],"amount":$amount,"currency":"USD","transaction_id":"$order_id","created_at":"$(date -u +'%Y-%m-%dT%H:%M:%SZ')"}
EOF
)

VERIFY_PAYLOAD=$(cat <<EOF
{"mobile":"$mobile","otp":"$OTP","order":$ORDER_JSON}
EOF
)

VERIFY_RESPONSE=$(curl -sS --max-time 5 -X POST "$BASE_URL/verify-otp" 
-H "Content-Type: application/json" 
-d "$VERIFY_PAYLOAD")

echo "✅ Done: $VERIFY_RESPONSE" | tee -a $LOG_FILE
echo "--------------------------------------" | tee -a $LOG_FILE

sleep 5
done

