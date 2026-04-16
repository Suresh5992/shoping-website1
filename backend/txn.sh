#!/bin/bash

while true
do
  i=$RANDOM
  MOBILE="77777$i"

  echo "🚀 Starting transaction for $MOBILE"

  RESPONSE=$(curl -s -X POST http://localhost:3000/api/send-otp \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$MOBILE\"}")

  echo "Raw response: $RESPONSE"

  OTP=$(echo $RESPONSE | jq -r '.demoOtp')

  echo "📩 OTP received: $OTP"

  if [ -z "$OTP" ] || [ "$OTP" = "null" ]; then
    echo "❌ Failed to get OTP"
    sleep 40
    continue
  fi

  sleep 2

  VERIFY_RESPONSE=$(curl -s -X POST http://localhost:3000/api/verify-otp \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$MOBILE\",\"otp\":\"$OTP\",\"order\":{\"id\":\"order$i\",\"item\":\"book\"}}")

  echo "✅ Response: $VERIFY_RESPONSE"
  echo "--------------------------------------"

  sleep 40
done
