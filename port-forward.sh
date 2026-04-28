#!/bin/bash

NAMESPACE="shopping"

echo "🚀 Starting port-forwards..."

# Kill old ones
pkill -f "kubectl port-forward" >/dev/null 2>&1

# Function to start and verify
start_pf() {
  NAME=$1
  SERVICE=$2
  LOCAL_PORT=$3
  REMOTE_PORT=$4

  echo "➡️  Starting $NAME..."

  kubectl port-forward svc/$SERVICE -n $NAMESPACE $LOCAL_PORT:$REMOTE_PORT > $NAME.log 2>&1 &

  PID=$!
  sleep 2

  # Check if process is still running
  if ps -p $PID > /dev/null; then
    echo "✅ $NAME running (localhost:$LOCAL_PORT)"
  else
    echo "❌ $NAME FAILED"
    echo "---- Logs ----"
    cat $NAME.log
    echo "--------------"
  fi
}

# Start services
start_pf "frontend" "frontend" 8081 80
start_pf "backend" "api" 3000 3000
start_pf "pgadmin" "pgadmin" 8085 80
start_pf "postgres" "postgres" 5432 5432

echo ""
echo "🌐 Access:"
echo "Frontend  → http://localhost:8081"
echo "Backend   → http://localhost:3000"
echo "pgAdmin   → http://localhost:8085"
echo "Postgres  → localhost:5432"
