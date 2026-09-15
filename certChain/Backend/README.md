# CertChain — Sprint 4 Backend Build

Application layer (Node.js + Express + MongoDB) for the Blockchain-Based
Certificate Verification System, per Section 2.14 and Section 4.4.3/4.4.5.
Implements every endpoint listed in Table 4.2, matching the mock
`api.js` in the Sprint 3 frontend function-for-function.

## Setup

```bash
cd Backend
npm install
cp .env.example .env     # then fill in MONGODB_URI and JWT_SECRET at minimum
npm run seed              # creates demo accounts + 2 certificates
npm run dev                # starts the API on http://localhost:5000
```

Requires Node.js ≥ 18 and a MongoDB connection string (Atlas, per Section
2.14, or any MongoDB 6+ instance — the `npm run seed` script uses a
transaction when creating a student, which needs MongoDB running as a
replica set; Atlas is one by default).

## What I could and couldn't verify in this environment

I don't have outbound network access in this sandbox, so I could not run
`npm install` against the real npm registry or connect to a real MongoDB
instance here. What I *did* verify:

- **`node --check` on every file** — confirms all 20 files are
  syntactically valid JavaScript.
- **A real, executable unit test suite** (`npm test`, using Node's
  built-in test runner — no dependencies needed) — 13 tests, all passing,
  covering the hashing utility, the blockchain simulation stub, and the
  centralized error handler. These are genuine tests that actually ran,
  not just written and assumed to work.

What I could **not** verify here: the Express routes wired to a live
MongoDB connection, the JWT auth flow end-to-end, or an actual
`npm install`. The code is written carefully and follows the same
patterns throughout, but please run `npm install && npm run dev` in your
own environment and sanity-check the endpoints (a Postman collection
outline is below) before treating this as fully proven.

## API endpoints (Table 4.2)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Returns a JWT + user profile |
| GET | `/api/students` | admin | List registered students |
| POST | `/api/students` | admin | Register a student |
| POST | `/api/certificates/issue` | admin | Hash + issue a certificate |
| GET | `/api/certificates?studentId=` | admin or self | List certificates |
| GET | `/api/certificates/:id` | admin or self | Get one certificate |
| POST | `/api/certificates/verify` | — (rate-limited) | Verify by number or hash |
| POST | `/api/certificates/:id/revoke` | admin | Revoke a certificate |
| GET | `/api/reports/summary` | admin | Dashboard stats |
| GET | `/api/health` | — | Liveness check |

All protected routes expect `Authorization: Bearer <token>`.

## Demo accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Administrator | `admin@svu.edu` | `admin123` |
| Student | `amina.yusuf@svu.edu` | `student123` |
| Student | `brian.otieno@svu.edu` | `student123` |

Same accounts as the Sprint 3 frontend mock data, so the two builds are
interchangeable for a live demo.

## What's real vs. simulated

- **Real:** password hashing (bcrypt), JWT issuance and verification,
  SHA-256 certificate hashing (Node's built-in `crypto`), MongoDB
  persistence via Mongoose, QR code generation (server-side, `qrcode`
  package, per Section 4.4.6), rate limiting on the public verify
  endpoint, centralized error handling, and role-based access control.
- **Real when configured, simulated otherwise:** the blockchain layer
  (`src/utils/blockchain.js`), updated in Sprint 5. If `SEPOLIA_RPC_URL`,
  `CONTRACT_ADDRESS` and `ADMIN_WALLET_PRIVATE_KEY` are all set in
  `.env`, every issuance and revocation is a real `ethers.js` call
  against the CertificateRegistry contract in the sibling
  sibling `Blockchain/` project. If any of those are missing, it falls back to
  the same clearly-labelled simulation Sprint 4 shipped with — every
  stored `BlockchainTransaction` records `simulated: true` or `false`
  so it's never ambiguous which mode produced a given record. See
  `../Blockchain/README.md` for how to deploy the contract and wire the
  two together.

## Connecting the Sprint 3 frontend

In `../api.js`, each function's real endpoint is already noted
in a comment. The swap is mechanical: replace the mock body with a
`fetch()` call to `http://localhost:5000/api/...`, attaching
`Authorization: Bearer <token>` (store the token returned by
`/api/auth/login` in memory the same way `currentUser` is already
handled) and set `CORS_ORIGIN` in `.env` to wherever the frontend is
served from.

## Project structure

```
Backend/
├── server.js                 Entry point — connects DB, starts Express
├── package.json
├── .env.example
├── scripts/
│   └── seed.js                 Demo data matching the frontend mocks
├── tests/                      Real, runnable unit tests (node --test)
│   ├── hash.test.js
│   ├── blockchain.test.js
│   └── errorHandler.test.js
└── src/
    ├── app.js                   Express app: middleware + route mounting
    ├── config/db.js              Mongoose connection
    ├── models/                   User, Student, Certificate,
    │                             VerificationLog, BlockchainTransaction
    │                             (Table 4.1)
    ├── controllers/              One file per resource
    ├── routes/                   One file per resource, mounted under /api
    ├── middleware/                auth (JWT + RBAC), rateLimiter,
    │                             errorHandler, validate
    └── utils/                     hash, blockchain (real + fallback),
                                  CertificateRegistry.abi.json, qr, jwt,
                                  AppError
```

## Next steps: Sprint 6

Sprint 5 (Blockchain Integration) is done — see `../Blockchain/README.md`.
Sprint 6 (Testing & Deployment) runs the full test matrix from Section
4.5 across all three layers together (unit, integration, system, user
acceptance, security, performance) and prepares the system for the
final defense/demo.
