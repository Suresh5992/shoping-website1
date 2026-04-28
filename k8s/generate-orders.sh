#!/bin/bash

BASE_URL=${BASE_URL:-http://localhost:3000/api}
HEALTH_URL="http://localhost:3000/healthz"

names=(
  "Suresh Naik"
  "Ravi Kumar"
  "Anitha Reddy"
  "Pooja Sharma"
  "Mahesh Babu"
  "Sneha Patil"
  "Kiran Rao"
  "Deepika Singh"
)

addresses=(
  "HNO: 582 Kukatpally Hyderabad"
  "MIG-2 KPHB Colony Hyderabad"
  "Banjara Hills Road No 12"
  "Madhapur Ayyappa Society"
  "SR Nagar Community Hall Lane"
  "Miyapur Hafeezpet Road"
)

products=(
  "Tomato:24"
  "Potato:32"
  "Onion:40"
  "Apple:120"
  "Banana:56"
  "Milk:28"
  "Rice:540"
  "Oil:175"
)

random_digits() {
  tr -dc 0-9 </dev/urandom | head -c "$1"
}

check_backend() {
  curl -s --max-time 2 "$HEALTH_URL" | grep -q "ok"
}

echo "🚀 Continuous Order Generator Started..."

while true; do
  echo ""
  echo "⏱ $(date)"

  # Check backend
  if ! check_backend; then
    echo "❌ Backend not reachable!"
    echo "👉 Run this first:"
    echo "kubectl port-forward -n shopping deploy/backend 3000:3000"
    sleep 5
    continue
  fi

  echo "✅ Backend is UP"

  # Generate 1 order
  name=${names[$RANDOM % ${#names[@]}]}
  address=${addresses[$RANDOM % ${#addresses[@]}]}
  mobile="9$(random_digits 9)"

  email_base=$(echo "$name" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z' '.')
  email="${email_base}${RANDOM}@gmail.com"

  order_id="ORD$(date +%Y%m%d%H%M%S)$RANDOM"

  item_count=$((RANDOM % 3 + 1))
  amount=0
  products_json="[]"

  for ((j=1; j<=item_count; j++)); do
    p=${products[$RANDOM % ${#products[@]}]}
    pname=$(echo $p | cut -d: -f1)
    price=$(echo $p | cut -d: -f2)
    qty=$((RANDOM % 3 + 1))

    subtotal=$((price * qty))
    amount=$((amount + subtotal))

    products_json=$(echo "$products_json" | jq \
      ". + [{\"name\":\"$pname\",\"price\":$price,\"quantity\":$qty,\"image\":\"images/si.jpg\"}]")
  done

  echo "🧾 New Order"
  echo "  Name   : $name"
  echo "  Email  : $email"
  echo "  Mobile : $mobile"
  echo "  Amount : ₹$amount"

  # STEP 1: SEND OTP
  send_response=$(curl -s -X POST "$BASE_URL/send-otp" \
    -H "Content-Type: application/json" \
    -d "{\"mobile\":\"$mobile\"}")

  otp=$(echo "$send_response" | jq -r '.demoOtp')

  if [[ "$otp" == "null" || -z "$otp" ]]; then
    echo "❌ OTP failed"
    sleep 30
    continue
  fi

  # STEP 2: VERIFY + ORDER
  verify_payload=$(jq -n \
    --arg mobile "$mobile" \
    --arg otp "$otp" \
    --arg txn "$order_id" \
    --arg name "$name" \
    --arg email "$email" \
    --arg address "$address" \
    --argjson amount "$amount" \
    --argjson products "$products_json" \
    '{
      mobile: $mobile,
      otp: $otp,
      order: {
        transaction_id: $txn,
        amount: $amount,
        products: $products,
        shipping: {
          name: $name,
          email: $email,
          mobile: $mobile,
          address: $address
        }
      }
    }')

  curl -s -X POST "$BASE_URL/verify-otp" \
    -H "Content-Type: application/json" \
    -d "$verify_payload" > /dev/null

  echo "  OTP    : $otp"
  echo "  Result : ✅ SUCCESS"

  echo "⏳ Waiting 30 seconds..."
  sleep 30

done
