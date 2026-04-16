#!/bin/bash

API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-3000}"
BASE_URL="http://$API_HOST:$API_PORT/api"

while true
do
  i=$RANDOM
  MOBILE="77777$i"

  echo "🚀 Starting transaction for $MOBILE"

  # Step 1: Send OTP
  RESPONSE=$(curl -sS -X POST "$BASE_URL/send-otp" \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$MOBILE\"}")

  echo "📩 Send OTP response: $RESPONSE"

  OTP=$(echo "$RESPONSE" | sed -n 's/.*"demoOtp":"\([0-9]*\)".*/\1/p')
  if [ -z "$OTP" ]; then
    echo "❌ Failed to parse OTP from response. Stopping simulator."
    break
  fi

  echo "📩 OTP received: $OTP"

  # small delay (important)
  sleep 2

  # Step 2: Verify OTP + create order
  VERIFY_RESPONSE=$(curl -sS -X POST "$BASE_URL/verify-otp" \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$MOBILE\",\"otp\":\"$OTP\",\"order\":{\"id\":\"order$i\"}}")

  echo "✅ Verify response: $VERIFY_RESPONSE"
  echo "--------------------------------------"

  # Step 3: wait 40 seconds before next transaction
  sleep 40
done
