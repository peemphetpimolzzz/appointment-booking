# BookEasy — Appointment Booking for Thai SMEs

[![CI](https://github.com/peemphetpimolzzz/appointment-booking/actions/workflows/ci.yml/badge.svg)](https://github.com/peemphetpimolzzz/appointment-booking/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A self-hosted appointment / booking system for small Thai businesses — clinics, salons,
and independent consultants. Customers pick a service, choose an open time slot, and get a
booking code they can use to look up or cancel their appointment. Owners manage their
services, weekly business hours, and the day's schedule from a simple admin panel.

The headline engineering feature is **double-booking prevention at two independent layers**,
so the same time slot can never be sold twice — even under a burst of simultaneous requests.

## Why I built it

Most small shops here juggle bookings over LINE chats and paper diaries, which makes
double-bookings routine. I wanted a single-origin, container-deployable app that makes
the "no two customers in the same chair at the same time" guarantee a property of the
database, not just the UI.

## Features

- **Two-layer double-booking prevention** (the core of the project):
  1. **Application layer** — every booking is created inside a Postgres
     `Serializable` transaction that re-checks for overlaps before inserting.
  2. **Database layer** — a PostgreSQL `GiST` `EXCLUDE` constraint (`btree_gist`)
     rejects any two `CONFIRMED` bookings whose time ranges overlap for the same
     service, atomically and regardless of how many requests race. Violations surface
     as a clean **409 Conflict**.
- **Availability engine** — open slots are computed from weekly business hours minus
  already-booked intervals minus past times. Times are stored in UTC; business hours are
  minutes-from-midnight in Asia/Bangkok (a fixed UTC+7 offset, no DST).
- **Customer flow** — pick service → date → open slot → confirm → receive a booking code.
- **Self-service lookup & cancel** — customers find and cancel their booking by code.
- **Admin panel** — manage services, edit the weekly schedule, and view/cancel the day's
  bookings.
- **Single origin, no CORS** — nginx reverse-proxies `/api` to the API container.

## Tech stack

| Layer    | Technology                                              |
| -------- | ------------------------------------------------------- |
| Backend  | Node.js, TypeScript, Express, Prisma ORM                |
| Database | PostgreSQL 16 (`btree_gist` exclusion constraint)       |
| Frontend | React, TypeScript, Vite, served by nginx                |
| Tests    | Vitest (unit), Supertest (integration), Playwright (e2e) |
| Infra    | Docker, Docker Compose                                   |

## Quick start

```bash
cp .env.example .env
docker compose up --build
```

- Web UI: <http://localhost:8080>
- API health: <http://localhost:8082/api/health>

The API container applies migrations (including the exclusion constraint), seeds a few
sample services and business hours, then starts serving. The seed is idempotent.

### Try the double-booking guard

```bash
# Create a booking for a slot...
curl -s -X POST http://localhost:8082/api/bookings \
  -H 'Content-Type: application/json' \
  -d '{"serviceId":1,"startsAt":"2026-06-09T03:00:00Z","customer":{"name":"A","phone":"0810000000"}}'

# ...then try the same slot again -> HTTP 409, { "error": { "code": "SLOT_TAKEN", ... } }
```

## API

All endpoints are under `/api`. Errors use a consistent envelope: `{ "error": { "code", "message" } }`.

| Method | Path                                          | Description                              |
| ------ | --------------------------------------------- | ---------------------------------------- |
| GET    | `/api/health`                                 | Liveness probe                           |
| GET    | `/api/services?active=true`                   | List services                            |
| POST   | `/api/services`                               | Create a service                         |
| PUT    | `/api/services/:id`                           | Update a service                         |
| DELETE | `/api/services/:id`                           | Deactivate a service                     |
| GET    | `/api/business-hours`                         | Weekly schedule                          |
| PUT    | `/api/business-hours`                         | Replace the weekly schedule              |
| GET    | `/api/availability?serviceId=&date=YYYY-MM-DD`| Open slots for a service on a day        |
| POST   | `/api/bookings`                               | Create a booking (transactional, guarded)|
| GET    | `/api/bookings/:code`                         | Look up a booking by code                |
| POST   | `/api/bookings/:code/cancel`                  | Cancel a booking                         |
| GET    | `/api/bookings?date=&serviceId=`              | Admin listing                            |

## Tests

```bash
# Unit tests — pure booking rules (overlap, business hours, slot generation)
docker run --rm -v "$PWD/backend:/app" -w /app node:22-bookworm-slim \
  sh -c "npm install && npx prisma generate && npm run test:unit"

# Integration tests — Supertest against a dedicated test Postgres
docker compose -f docker-compose.yml -f docker-compose.test.yml run --build --rm integration-tests

# End-to-end — Playwright against the full stack
docker compose up -d --build
docker compose -f docker-compose.yml -f docker-compose.test.yml run --build --rm e2e
```

The integration suite includes a concurrency proof: four identical booking requests are
fired simultaneously and exactly one succeeds (201) while the rest get 409.

## Ports

| Service  | Host port | Notes                                   |
| -------- | --------- | --------------------------------------- |
| Web      | 8080      | `WEB_PORT`                              |
| API      | 8082      | `API_PORT`                              |
| Postgres | 15432     | `DB_PORT` (off 5432 to avoid clashes)   |

## License

MIT — see [LICENSE](LICENSE).
