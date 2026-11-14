# Doctor Tracker API Documentation

Base URL: `http://localhost:4000/api`

All responses use a consistent envelope:

```json
// Success
{ "success": true, "data": { ... }, "meta": { ... }?, "message": "..." }

// Error
{ "success": false, "error": { "message": "...", "code": "...", "details": [...]? } }
```

**Status codes**: 200 OK · 201 Created · 400 invalid id/format · 401 auth failure · 403 forbidden · 404 not found · 409 conflict (duplicate email / blocked doctor deletion) · 422 validation error · 429 rate limited · 500 internal.

**Authentication**: send `Authorization: Bearer <accessToken>` on every protected endpoint. Access tokens expire in 15 min (`401`, `code: "TOKEN_EXPIRED"`); rotate via `POST /auth/refresh`.

---

## Authentication

### POST /auth/login
Rate-limited: 10 failed attempts / 15 min per IP.

```json
{ "email": "admin@careguide.dev", "password": "Admin@12345" }
```

**200**
```json
{
  "success": true,
  "data": {
    "user": { "id": "...", "name": "Portal Administrator", "email": "admin@careguide.dev", "role": "admin" },
    "accessToken": "<jwt>",
    "refreshToken": "<128-hex-char opaque token>"
  }
}
```

Errors: `401` invalid credentials (uniform message for unknown email and wrong password — prevents enumeration), `422` malformed input.

### POST /auth/refresh
```json
{ "refreshToken": "<current refresh token>" }
```
Returns a **new pair** and revokes the presented token (single-use rotation). Reusing a rotated token: `401 REFRESH_INVALID`.

### POST /auth/logout
```json
{ "refreshToken": "<token to revoke>" }
```
**200** — token permanently revoked server-side.

### GET /auth/me — Bearer
Returns the current user (`id`, `name`, `email`, `role`, `createdAt`). Password hashes are never included in any response.

---

## Doctors

All doctor list/detail endpoints accept an authenticated user; mutations require role `admin`.

### Query parameters — GET /doctors

| Param | Type | Notes |
|---|---|---|
| `page` | int ≥1 (default 1) | |
| `limit` | int 1–100 (default 10) | |
| `search` | string ≤120 | case-insensitive partial match over name, email, specialization, hospital |
| `specialization` | enum | Cardiology, Dermatology, Endocrinology, Gastroenterology, General Medicine, Neurology, Orthopedics, Pediatrics, Psychiatry, Pulmonology, Urology |
| `hospital` | string | case-insensitive partial match |
| `createdFrom` | YYYY-MM-DD | createdAt ≥ from |
| `createdTo` | YYYY-MM-DD | createdAt ≤ to (inclusive day) |
| `sortBy` | `createdAt` (default) · `name` · `specialization` | |
| `sortOrder` | `desc` (default) · `asc` | |

### GET /doctors — 200
```json
{
  "success": true,
  "data": [
    { "_id": "...", "name": "Dr. Ayesha Rahman", "specialization": "Cardiology",
      "hospital": "Square Care Hospital", "phone": "+880 1711 200 101",
      "email": "ayesha.rahman@careguide.dev", "createdAt": "2026-09-17T10:00:00.000Z" }
  ],
  "meta": { "page": 1, "limit": 10, "total": 11, "totalPages": 2 }
}
```

### POST /doctors — 201
Body (all fields required):
```json
{
  "name": "Dr. Anika Chowdhury",
  "specialization": "Cardiology",
  "hospital": "Square Care Hospital",
  "phone": "+880 1711 555 001",
  "email": "anika.chowdhury@careguide.dev"
}
```
Errors: `409 CONFLICT` duplicate email · `422 VALIDATION_ERROR` with `details: [{ path, message }]`.

### GET /doctors/:id — 200
Doctor fields + `patientCount`.

### PUT /doctors/:id — 200
Partial body (same fields as create). Duplicate email → 409.

### DELETE /doctors/:id — 200
Blocked with `409 CONFLICT` while the doctor still has patients (message names the count). Delete or reassign the patients first.

### GET /doctors/:id/patients
Paginated patients belonging to the doctor. Accepts the patient query params (see below, minus `doctorId`). Patient docs omit `doctorId` (implicit).

### POST /doctors/:id/patients — 201
Body = patient payload (see POST /patients) **without** `doctorId` — the path doctor is used.

---

## Patients

### Query parameters — GET /patients

| Param | Type | Notes |
|---|---|---|
| `page`, `limit` | int | as above |
| `search` | string | over name, phone, email, condition, address |
| `doctorId` | ObjectId | only this doctor's patients |
| `condition` | enum | hypertension, diabetes, asthma, cardiac, orthopedic, dermatology, neurological, other |
| `status` | enum | active, recovering, critical, discharged |
| `gender` | enum | male, female, other |
| `createdFrom` / `createdTo` | YYYY-MM-DD | registration date range |
| `sortBy` | `createdAt` (default) · `name` · `condition` · `status` | |
| `sortOrder` | `desc` (default) · `asc` | |

### POST /patients — 201
```json
{
  "name": "Rahim Uddin",
  "doctorId": "<doctor ObjectId>",
  "phone": "+880 1811 555 002",
  "email": "rahim.uddin@example.com",
  "gender": "male",
  "dateOfBirth": "1988-04-12",
  "condition": "diabetes",
  "status": "active",
  "address": "12/B Dhanmondi, Dhaka",
  "notes": "Regular check-up every 3 months."
}
```
Required: `name`, `doctorId`, `phone`, `gender`, `condition`, `status`. `doctorId` must reference an existing doctor → otherwise `422` (prevents orphaned patients).

### GET /patients/:id — 200
Patient fields + `doctor: { name, specialization, hospital, email, phone }`.

### PUT /patients/:id — 200
Partial update. `doctorId` may be changed (validated against existing doctors).

### DELETE /patients/:id — 200
Removes the patient (and therefore from the doctor's patient list).

---

## Dashboard

### GET /dashboard/overview — 200
```json
{
  "totalDoctors": 11,
  "totalPatients": 64,
  "avgPatientsPerDoctor": 5.8,
  "activeDoctors": 11,
  "newPatientsLast7Days": 8,
  "newPatientsLast30Days": 31,
  "criticalPatients": 2,
  "dischargedPatients": 3,
  "byCondition": [{ "_id": "diabetes", "count": 18 }],
  "byGender": [{ "_id": "male", "count": 35 }],
  "byStatus": [{ "_id": "active", "count": 40 }],
  "registrationsByDay": [{ "_id": "2026-11-01", "patients": 2, "doctors": 0 }]
}
```
`registrationsByDay` covers the last 30 days.

### GET /dashboard/analytics?days=7|14|30|60|90 (default 14)
```json
{
  "patientsPerDoctor": [
    { "doctorId": "...", "doctorName": "Dr. Ayesha Rahman", "specialization": "Cardiology",
      "hospital": "Square Care Hospital", "patientCount": 12 }
  ],
  "doctorsPerDay": [{ "_id": "2026-11-01", "count": 1 }],
  "patientsPerDay": [{ "_id": "2026-11-01", "count": 3 }],
  "totalDoctors": 11,
  "totalPatients": 64,
  "windowDays": 14
}
```
`patientsPerDoctor` = top 8 doctors by patient count.

### GET /dashboard/recent — 200
`{ "doctors": [5 newest], "patients": [5 newest] }` (id, name, + key fields, createdAt).

---

## Health

### GET /health — 200 `{ "success": true, "data": { "status": "ok", "uptime": 123.45 } }`
No authentication. Does not count against the API rate limit bucket semantics of auth endpoints.

---

## Error codes

| code | meaning |
|---|---|
| `UNAUTHORIZED` | missing/malformed header or user gone |
| `TOKEN_INVALID` | JWT verification failed |
| `TOKEN_EXPIRED` | access token expired → refresh |
| `REFRESH_INVALID` | refresh token unknown/revoked/expired |
| `FORBIDDEN` | authenticated but role insufficient |
| `NOT_FOUND` | record missing |
| `INVALID_ID` | malformed ObjectId |
| `CONFLICT` | duplicate email or blocked doctor deletion |
| `VALIDATION_ERROR` | zod validation, `details` lists fields |
| `RATE_LIMITED` | too many requests |
| `ROUTE_NOT_FOUND` | unknown endpoint |
| `INTERNAL_ERROR` | unexpected (details hidden in production) |
