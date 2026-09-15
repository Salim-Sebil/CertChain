# CertChain API and Backend Flow

This document explains how the front-end API layer in `api.js` talks to the backend, and how the request flow works across the application.

---

## 1) High-level overview

The project is split into three layers:

1. Front-end UI layer
   - `index.html`
   - `app.js`
   - `data.js`

2. Front-end API layer
   - `api.js`

3. Back-end server layer
   - `server.js`
   - `src/`
   - MongoDB database

The front-end does not talk directly to the database. Instead, it uses `api.js` to send HTTP requests to the Express API running on the backend.

---

## 2) What `api.js` does

`api.js` is a wrapper around `fetch()` calls to the backend API. It hides the raw HTTP logic and exposes simple functions such as:

- `Api.login()`
- `Api.registerStudent()`
- `Api.getAllCertificates()`
- `Api.issueCertificate()`
- `Api.getReportSummary()`
- `Api.verifyCertificate()`
- `Api.revokeCertificate()`

These functions are called from `app.js` whenever a user clicks a button or submits a form.

---

## 3) How the front-end calls the backend

A typical flow looks like this:

```js
const response = await fetch("/api/auth/login", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email, password })
});
```

In the actual project, this logic is wrapped in `api.js` so the UI code stays neat and readable.

Example pattern:

```js
static async login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Login failed");
  return data.data.user;
}
```

---

## 4) Authentication flow

### Login
When the user logs in:
1. `app.js` calls `Api.login(email, password)`
2. `api.js` sends a POST request to `/api/auth/login`
3. backend validates the credentials
4. backend returns a JWT and user profile
5. `app.js` stores user info in `currentUser`
6. user is redirected to either `/admin` or `/student`

### JWT usage
Protected routes require a token in the `Authorization` header:

```http
Authorization: Bearer <token>
```

The front-end stores the token in session memory and sends it on future requests for protected endpoints.

---

## 5) Admin flow

### Register student
Flow:
1. admin fills the registration form in `app.js`
2. `Api.registerStudent(payload)` sends a POST request to `/api/students`
3. backend validates input
4. backend creates the student record and optional user account
5. response returns created student data or reset link info
6. admin dashboard updates the student dropdown

### Issue certificate
Flow:
1. admin selects a student and degree
2. `Api.issueCertificate()` sends a request to `/api/certificates/issue`
3. backend hashes the certificate
4. backend stores the certificate record and blockchain transaction metadata
5. backend responds with the issued certificate details
6. admin sees the updated ledger and stats

### Ledger and reports
Flow:
1. `Api.getAllCertificates()` fetches all certificates
2. `Api.getReportSummary()` fetches summary metrics
3. `app.js` renders the table and bar chart

---

## 6) Student flow

### View certificates
When the student loads `/student`:
1. `app.js` calls `Api.getCertificatesForStudent(studentId)`
2. backend fetches certificates belonging to that student
3. front-end renders a list of certificate cards

### Download certificate
The student can download a JSON file with:
- certificate number
- degree
- issue date
- status
- hash
- transaction hash
- verification URL

### Show QR / transaction details
The front-end calls helper endpoints or uses the locally stored certificate data to display:
- QR code
- blockchain transaction metadata

---

## 7) Verification flow

### Public verify route
Anyone can verify a certificate without login.

The flow is:
1. user enters certificate number or uploads a JSON file
2. `app.js` calls `Api.verifyCertificate(query)`
3. backend checks the certificate record
4. backend compares hash or certificate number against stored data
5. backend responds with:
   - valid
   - revoked
   - not_found
6. front-end displays the outcome

This is the public verification experience used by verifiers.

---

## 8) Backend request pipeline

The backend logic is in the `src/` folder and is mounted by `server.js`.

Typical pipeline:

1. `server.js` starts the Express app
2. `connectDB()` connects MongoDB
3. `createApp()` builds the Express app with middleware and routes
4. incoming request hits middleware
5. route matches the URL
6. controller handles business logic
7. model interacts with MongoDB
8. response returns JSON to the client

### Middleware stages
Typical order:
- CORS
- Helmet
- JSON parser
- rate limiting
- logging
- JWT protection
- role-based authorization
- validation
- error handling

---

## 9) Backend resource structure

The backend is organized by resource:

- `auth` → login, password change, token creation
- `students` → student registration and listing
- `certificates` → issue, verify, revoke, list
- `reports` → dashboard stats

This keeps responsibilities separated and easier to maintain.

---

## 10) Example request lifecycle

### Example: admin issues a certificate

1. Admin clicks “Issue Certificate” in the UI
2. `app.js` reads form values
3. `Api.issueCertificate(payload)` is called
4. `api.js` sends a POST request to `/api/certificates/issue`
5. backend route calls the certificate controller
6. controller validates fields and user authorization
7. controller creates or updates the certificate record
8. model saves to MongoDB
9. backend returns success JSON
10. `app.js` refreshes the ledger and report tiles

---

## 11) Why this architecture works

This design separates concerns cleanly:

- `app.js` handles UI state and page rendering
- `api.js` handles HTTP communication
- backend controllers handle business logic
- models handle database interaction
- MongoDB stores persisting data

This is a standard and maintainable pattern for a small full-stack app.

---

## 12) Simple flow diagram

```text
User clicks button
        ↓
app.js
        ↓
Api.<function>()
        ↓
HTTP request to backend endpoint
        ↓
Express route
        ↓
Controller logic
        ↓
MongoDB model / database
        ↓
JSON response
        ↓
UI refreshes with new data
```

---

## 13) Quick cheat sheet for the API layer

| Function | Purpose |
|---|---|
| `Api.login()` | Sign in and get the JWT |
| `Api.setPassword()` | Change current user password |
| `Api.registerStudent()` | Add a new student |
| `Api.getAllCertificates()` | Fetch all certificates for admin |
| `Api.getCertificatesForStudent()` | Fetch student’s own certificates |
| `Api.issueCertificate()` | Issue a certificate |
| `Api.revokeCertificate()` | Revoke an issued certificate |
| `Api.getReportSummary()` | Dashboard summary stats |
| `Api.verifyCertificate()` | Check if a certificate is valid |

---

## 14) Summary

The API layer is the bridge between the front-end interface and the backend server. The front-end never talks to MongoDB directly; it sends requests through `api.js`, and the backend handles validation, permissions, database operations, and responses.

This keeps the app modular and makes it easier to demo, debug, and extend.
