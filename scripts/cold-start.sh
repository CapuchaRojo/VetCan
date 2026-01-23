#!/usr/bin/env bash
set -e

echo "🧊 VetCan Cold Start Initiated"

echo "🛑 Stopping existing containers..."
docker compose down -v

echo "🧹 Cleaning dangling containers and networks..."
docker system prune -f

echo "🚀 Starting core services..."
docker compose up -d db redis n8n

echo "⏳ Waiting for database to be ready..."
sleep 5

echo "🔧 Building and starting application services..."
docker compose up -d --build api worker web

echo "⏳ Waiting for API container..."
sleep 5

echo "🧬 Running Prisma migrations (Postgres)..."
docker exec -it vetcan-api-1 npx prisma@5.22.0 migrate deploy || \
docker exec -it vetcan-api-1 npx prisma@5.22.0 migrate dev --name init_postgres

echo "🧬 Generating Prisma Client..."
docker exec -it vetcan-api-1 npx prisma@5.22.0 generate

echo "✅ VetCan Cold Start Complete"
echo ""
echo "🌐 Web:   http://localhost:5173"
echo "🔌 API:   http://localhost:4000"
echo "🧠 n8n:   http://localhost:5678"
