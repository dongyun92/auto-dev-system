#!/bin/bash

echo "Testing Database Setup..."

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

# Start PostgreSQL
echo "Starting PostgreSQL with Docker Compose..."
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is running
if docker-compose ps | grep -q "todo-api-db.*running"; then
    echo -e "${GREEN}✓ PostgreSQL is running${NC}"
else
    echo -e "${RED}✗ PostgreSQL failed to start${NC}"
    exit 1
fi

# Test database connection
echo "Testing database connection..."
docker exec todo-api-db pg_isready -U todo_user -d todo_db
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Database connection successful${NC}"
else
    echo -e "${RED}✗ Database connection failed${NC}"
    exit 1
fi

# Install Flyway if not present
if ! command -v flyway &> /dev/null; then
    echo "Flyway not found. Please install Flyway to run migrations."
    echo "Visit: https://flywaydb.org/documentation/usage/commandline/"
else
    # Run migrations
    echo "Running database migrations..."
    flyway -configFiles=flyway.conf migrate
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Migrations completed successfully${NC}"
    else
        echo -e "${RED}✗ Migration failed${NC}"
        exit 1
    fi
    
    # Check migration status
    echo "Checking migration status..."
    flyway -configFiles=flyway.conf info
fi

# Verify tables exist
echo "Verifying database tables..."
TABLES=$(docker exec todo-api-db psql -U todo_user -d todo_db -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public';")

if echo "$TABLES" | grep -q "users"; then
    echo -e "${GREEN}✓ Users table exists${NC}"
else
    echo -e "${RED}✗ Users table not found${NC}"
fi

if echo "$TABLES" | grep -q "todos"; then
    echo -e "${GREEN}✓ Todos table exists${NC}"
else
    echo -e "${RED}✗ Todos table not found${NC}"
fi

echo -e "\n${GREEN}Database setup test completed!${NC}"
echo "To stop the database, run: docker-compose down"
echo "To remove all data, run: docker-compose down -v"