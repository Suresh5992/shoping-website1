#!/bin/bash

API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-3000}"
BASE_URL="http://$API_HOST:$API_PORT/api"

names=(Alice Bob Carol Dave Eve Frank Grace Harry Iris Jack)
products=("Smartphone" "Headphones" "Laptop" "Coffee Maker" "Running Shoes" "Backpack" "Wireless Mouse" "Keyboard" "Desk Lamp" "Water Bottle")

random_item() {
  local arr=("${!1}")
  echo "${arr[$RANDOM % ${#arr[@]}]}"
}

while true
 do
  i=$RANDOM
  first_name=$(random_item names[@])
  product=$(random_item products[@])
  mobile="7$(printf '%09d' $((RANDOM * RANDOM % 1000000000)))"
  email="${first_name,,}$((RANDOM % 1000))@gmail.com"
  order_id="txn-$((RANDOM))-$((SECONDS))"
  quantity=$(( (RANDOM % 5) + 1 ))
  price=$(( (RANDOM % 90) + 10 ))
  amount=$(( quantity * price ))

  echo "🚀 Starting transaction: $order_id"
  echo "   customer: $first_name <$email>"
  echo "   mobile: $mobile"
  echo "   item: $product x$quantity @ $price"
  echo "   total: $amount"

  # Step 1: Send OTP
  RESPONSE=$(curl -sS -X POST "$BASE_URL/send-otp" \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$mobile\"}")

  echo "📩 Send OTP response: $RESPONSE"

  OTP=$(echo "$RESPONSE" | sed -n 's/.*"demoOtp":"\([0-9]*\)".*/\1/p')
  if [ -z "$OTP" ]; then
    echo "❌ Failed to parse OTP from response. Stopping simulator."
    break
  fi

  echo "📩 OTP received: $OTP"
  sleep 2

  # Step 2: Verify OTP + create order
  ORDER_JSON=$(cat <<EOF
{"id":"$order_id","customer":{"name":"$first_name","email":"$email","mobile":"$mobile"},"items":[{"product":"$product","quantity":$quantity,"price":$price}],"amount":$amount,"currency":"USD","transaction_id":"$order_id","created_at":"$(date -u +'%Y-%m-%dT%H:%M:%SZ')"}
EOF
)

  VERIFY_PAYLOAD=$(cat <<EOF
{"mobile":"$mobile","otp":"$OTP","order":$ORDER_JSON}
EOF
)

  VERIFY_RESPONSE=$(curl -sS -X POST "$BASE_URL/verify-otp" \
    -H "Content-Type: application/json" \
    -d "$VERIFY_PAYLOAD")

  echo "✅ Verify response: $VERIFY_RESPONSE"
  echo "--------------------------------------"

  sleep 10
 done
