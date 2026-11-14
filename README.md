# Doctor Tracker — Backend

REST API for the Care Guide / Doctor Tracker administrative portal. Built with **Node.js + Express 4 + MongoDB (Mongoose 8) + TypeScript**. Serves authentication (JWT access + rotating refresh tokens), doctor management, patient management, and dashboard analytics backed by MongoDB aggregation pipelines.

## Features

- **Authentication** — bcrypt-hashed passwords, short-lived JWT access tokens (15 min), rotating refresh tokens (7 d, SHA-256 hashed at rest, revocable on logout), role-based authorization middleware.
- **Doctors** — full CRUD with the five spec fields (name, specialization, hospital, phone, email), search, date-range/specialization/hospital filters, server-side pagination, per-doctor patient listing, patient creation under a doctor.
- **Patients** — full CRUD, search, condition/status/gender/doctor/date filters, server-side pagination, mandatory doctor relationship (no orphans).
- **Dashboard** — live analytics: totals, patients-per-doctor average, condition/gender/status distributions, 7/30-day growth, daily registration series, top doctors by patient load, recent records. All computed by aggregation pipelines — nothing hardcoded.
- **Security** — helmet headers, CORS allow-list, global + login rate limiting, NoSQL-injection sanitization, regex-escaped search, centralized error handling with safe production messages.
- **Performance** — purpose-built indexes (single + compound), `lean()` reads, selective projections, `$facet` single-pass aggregations, parallel queries via `Promise.all`.

## Requirements

- Node.js ≥ 20
- MongoDB ≥ 6 (local instance or Atlas connection string)

## Installation

```bash
cd backend
npm install
cp .env.example .env        # then edit values (see below)
```

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | no | `development` | `development` / `test` / `production` |
| `PORT` | no | `4000` | HTTP port |
| `MONGODB_URI` | yes | `mongodb://127.0.0.1:27017/care_guide_test` | Mongo connection string |
| `JWT_ACCESS_SECRET` | **yes** | — | ≥32 random chars. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_REFRESH_SECRET` | **yes** | — | Different ≥32 random chars |
| `JWT_ACCESS_EXPIRES_IN` | no | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRES_DAYS` | no | `7` | Refresh token lifetime |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Comma-separated allow-list |
| `BCRYPT_COST` | no | `12` | Password hash cost |
| `SEED_ADMIN_EMAIL` | no | `admin@careguide.dev` | Seed admin account |
| `SEED_ADMIN_PASSWORD` | no | `Admin@12345` | Seed admin password |

> Generate secrets before first run — the server refuses to boot without valid secrets (validated at startup).

## MongoDB setup (local)

**Option A — already have MongoDB running:** just point `MONGODB_URI` at it.

**Option B — install MongoDB Community Server:** <https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/> and start the service (`net start MongoDB`).

**Option C — portable (no service):**

```powershell
mkdir E:\tools\mongo-data
E:\tools\mongodb\bin\mongod.exe --dbpath E:\tools\mongo-data --port 27017
```

## Database seeding

```bash
npm run seed        # creates admin if missing + realistic doctors/patients if collections empty
npm run seed:fresh  # wipes users/doctors/patients and rebuilds everything
```

Seed data: 1 admin account, 11 doctors across 11 specializations, 64 patients distributed over ~8 weeks (so date filters and charts have meaningful data).

## Development commands

```bash
npm run dev          # ts-node-dev with auto reload, http://localhost:4000
npm run build        # compile to dist/
npm start            # run compiled output
npm test             # Jest + Supertest against an isolated in-memory MongoDB
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint (flat config, typescript-eslint)
npm run format       # Prettier
```

## API endpoints

Base URL: `http://localhost:4000/api` — full request/response documentation in [`docs/API.md`](docs/API.md).

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/login` | — | Log in, returns access + refresh tokens |
| POST | `/auth/refresh` | — | Rotate refresh token, new pair |
| POST | `/auth/logout` | — | Revoke refresh token |
| GET | `/auth/me` | Bearer | Current user profile |
| GET | `/doctors` | Bearer | List doctors (search/filters/pagination) |
| POST | `/doctors` | Admin | Create doctor |
| GET | `/doctors/:id` | Bearer | Doctor details + patient count |
| PUT | `/doctors/:id` | Admin | Update doctor |
| DELETE | `/doctors/:id` | Admin | Delete doctor (409 if patients exist) |
| GET | `/doctors/:id/patients` | Bearer | Paginated patients of a doctor |
| POST | `/doctors/:id/patients` | Admin | Create patient under doctor |
| GET | `/patients` | Bearer | List patients (search/filters/pagination) |
| POST | `/patients` | Admin | Create patient |
| GET | `/patients/:id` | Bearer | Patient details + doctor info |
| PUT | `/patients/:id` | Admin | Update patient (reassign doctor allowed) |
| DELETE | `/patients/:id` | Admin | Delete patient |
| GET | `/dashboard/overview` | Bearer | Totals + distributions + daily series |
| GET | `/dashboard/analytics` | Bearer | Patients-per-doctor ranking + daily growth |
| GET | `/dashboard/recent` | Bearer | Recent doctors and patients |
| GET | `/health` | — | Liveness probe |

## Authentication model

1. `POST /auth/login` with `{ email, password }` → `{ accessToken, refreshToken, user }`.
2. Send `Authorization: Bearer <accessToken>` on every protected request.
3. Access tokens expire after 15 minutes. When a call returns `401 TOKEN_EXPIRED`, call `POST /auth/refresh` with the refresh token — the old token is revoked and a fresh pair is returned.
4. `POST /auth/logout` with the refresh token revokes it server-side; the client discards both tokens.

## Testing

```bash
npm test
```

Tests use `mongodb-memory-server` (an isolated throwaway MongoDB) — your real database is never touched. Suites cover auth (valid/invalid/missing credentials, invalid/expired/forged tokens, rotation, logout revocation), doctors (CRUD, duplicate email, search incl. regex-safety, specialization/date filters, pagination, relationship views), patients (CRUD, orphan prevention, all filters, pagination), and dashboard (empty DB, totals, patients-per-doctor, date windows, analytics ranking).

## Project structure

```
src/
├── config/        env validation (zod), database connection
├── controllers/   thin HTTP handlers
├── services/      business logic (auth, doctor, patient, dashboard)
├── models/        Mongoose schemas + indexes
├── middleware/    auth, validation, rate limiting, error handling
├── routes/        Express routers
├── validators/    zod schemas per resource
├── utils/         ApiError, JWT helpers, pagination, regex safety
└── app.ts/server.ts
tests/             Jest + Supertest suites
scripts/seed.ts    development seed data
```
