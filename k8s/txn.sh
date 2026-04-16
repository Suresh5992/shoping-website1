#!/bin/bash

while true
do
  i=$RANDOM
  MOBILE="77777$i"

  echo "🚀 Starting transaction for $MOBILE"

  # Step 1: Send OTP
  RESPONSE=$(curl -s -X POST http://localhost:3000/api/send-otp \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$MOBILE\"}")

  OTP=$(echo $RESPONSE | sed -n 's/.*"demoOtp":"\([0-9]*\)".*/\1/p')

  echo "📩 OTP received: $OTP"

  # small delay (important)
  sleep 2

  # Step 2: Verify OTP + create order
  VERIFY_RESPONSE=$(curl -s -X POST http://localhost:3000/api/verify-otp \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$MOBILE\",\"otp\":\"$OTP\",\"order\":{\"id\":\"order$i\"}}")

  echo "✅ Response: $VERIFY_RESPONSE"
  echo "--------------------------------------"

  # Step 3: wait 40 seconds before next transaction
  sleep 40
done
