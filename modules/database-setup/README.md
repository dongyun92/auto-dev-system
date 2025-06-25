# Database Setup Module

This module provides the database infrastructure for the Todo API system using PostgreSQL, Docker, and Flyway for migrations.

## Prerequisites

- Docker and Docker Compose
- PostgreSQL client (optional, for manual access)
- Flyway CLI (for running migrations manually)

## Quick Start

1. Start the PostgreSQL database:
   ```bash
   docker-compose up -d
   ```

2. Run database migrations:
   ```bash
   flyway -configFiles=flyway.conf migrate
   ```

## Database Schema

### Users Table
- `id` (UUID): Primary key
- `username` (VARCHAR): Unique username
- `email` (VARCHAR): Unique email address
- `password_hash` (VARCHAR): Hashed password
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

### Todos Table
- `id` (UUID): Primary key
- `user_id` (UUID): Foreign key to users table
- `title` (VARCHAR): Todo title
- `description` (TEXT): Todo description
- `completed` (BOOLEAN): Completion status
- `created_at` (TIMESTAMP): Creation timestamp
- `updated_at` (TIMESTAMP): Last update timestamp

## Configuration

### Database Connection
Connection details are configured in `database.env`:
- `DATABASE_HOST`: PostgreSQL host (default: localhost)
- `DATABASE_PORT`: PostgreSQL port (default: 5432)
- `DATABASE_NAME`: Database name (default: todo_db)
- `DATABASE_USER`: Database user (default: todo_user)
- `DATABASE_PASSWORD`: Database password

### Docker Compose
The `docker-compose.yml` file configures:
- PostgreSQL 15 Alpine image
- Database initialization with user and database
- Health checks
- Persistent volume for data

### Flyway Migrations
Migrations are located in the `migrations/` directory:
- `V1__Create_users_table.sql`: Creates the users table
- `V2__Create_todos_table.sql`: Creates the todos table with foreign key relationship

## Usage

### Starting the Database
```bash
docker-compose up -d
```

### Stopping the Database
```bash
docker-compose down
```

### Removing All Data
```bash
docker-compose down -v
```

### Accessing the Database
```bash
docker exec -it todo-api-db psql -U todo_user -d todo_db
```

### Running Migrations
```bash
flyway -configFiles=flyway.conf migrate
```

### Checking Migration Status
```bash
flyway -configFiles=flyway.conf info
```

## Development

### Adding New Migrations
1. Create a new SQL file in `migrations/` following the naming convention: `V{version}__Description.sql`
2. Write your SQL statements
3. Run `flyway migrate` to apply the migration

### Database Backup
```bash
docker exec todo-api-db pg_dump -U todo_user todo_db > backup.sql
```

### Database Restore
```bash
docker exec -i todo-api-db psql -U todo_user todo_db < backup.sql
```