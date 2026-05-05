# RTO API

This project is a Fastify-based API with authentication using Prisma, PostgreSQL, JWT, Passport, Redis, and service-oriented architecture.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables in `.env`:
   - DATABASE_URL: Your PostgreSQL connection string
   - JWT_SECRET: Secret key for JWT
   - REDIS_URL: Redis connection URL
   - EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS: For email sending
   - APP_URL: Base URL of the app

3. Set up the database:
   ```bash
   npm run db:migrate
   ```

4. Generate Prisma client:
   ```bash
   npm run db:generate
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

## API Endpoints

- POST /auth/register: Register a new user
- POST /auth/login: Login
- POST /auth/logout: Logout
- POST /auth/forgot-password: Request password reset
- POST /auth/reset-password: Reset password
- GET /auth/me: Get current user (protected)

## Architecture

- Services: Business logic in `src/services/`
- Routes: API endpoints in `src/routes/`
- Plugins: Fastify plugins in `src/plugins/`
- Models: Prisma schema in `prisma/schema.prisma`

## Learn More

To learn Fastify, check out the [Fastify documentation](https://fastify.dev/docs/latest/).
