#!/bin/bash

NAMESPACE="shopping"

echo "🧹 Cleaning old port-forwards..."
pkill -f "kubectl port-forward" 2>/dev/null

echo "🔍 Checking services in namespace: $NAMESPACE"
kubectl get svc -n $NAMESPACE || {
  echo "❌ Namespace or services not found!"
  exit 1
}

echo "🚀 Starting port-forwards..."

# Backend (API)
kubectl port-forward svc/api 3000:3000 -n $NAMESPACE > backend.log 2>&1 &
API_PID=$!

# Frontend
kubectl port-forward svc/frontend 8084:80 -n $NAMESPACE > frontend.log 2>&1 &
FRONT_PID=$!

# Postgres
kubectl port-forward svc/postgres 5432:5432 -n $NAMESPACE > postgres.log 2>&1 &
POSTGRES_PID=$!

sleep 3

echo "🔍 Verifying ports..."

lsof -i :3000 || echo "❌ API not running"
lsof -i :8084 || echo "❌ Frontend not running"
lsof -i :5432 || echo "❌ Postgres not running"

echo ""
echo "✅ Access URLs:"
echo "Frontend : http://localhost:8084"
echo "Backend  : http://localhost:3000"
echo "Postgres : localhost:5432"
echo ""

# Cleanup on exit
cleanup() {
  echo "🛑 Stopping all port-forwards..."
  kill $API_PID $FRONT_PID $POSTGRES_PID 2>/dev/null
}
trap cleanup EXIT

echo "📡 Port-forward running... Press Ctrl+C to stop"

wait
