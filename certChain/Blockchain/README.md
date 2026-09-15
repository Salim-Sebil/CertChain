# CertChain — Sprint 5 Blockchain Build

Smart contract layer (Solidity + Hardhat) for the Blockchain-Based
Certificate Verification System, per Section 4.3.5 and Section 4.4.4.

## What I could and couldn't verify in this environment

This sandbox has no outbound network access, so I could not run
`npm install` (Hardhat and its toolbox need the npm registry), and no
Solidity compiler is available locally, so **I could not compile, deploy,
or run the test suite here.** This is a real limitation, not a formality
— please treat that as the honest status until you've run it yourself.

What I did do instead:

- Wrote `CertificateRegistry.sol` carefully against the design already
  agreed in Section 4.3.5 and the class diagram from Sprint 2.
- Ran a manual brace/parenthesis/bracket balance check across the
  contract (12 `{}` pairs, 36 `()` pairs, 12 `[]` pairs, all balanced,
  zero unclosed scopes) — a real but limited check; it catches gross
  structural errors, not type errors or logic bugs a real compiler run
  would catch.
- Ran `node --check` on every `.js` file (config, deploy script, verify
  script, test file) — confirms they're syntactically valid JavaScript.
- Wrote a full Hardhat/Chai test suite (28 test cases) covering every
  function, every `require()` guard, and every event — but **these
  tests have not actually been executed.** They're written to the same
  standard as the tests I did run and verify in Sprints 1-4, but until
  you run `npm test` yourself, treat them as reviewed-but-unproven.

**Please run `npm install && npm test` yourself before trusting this
contract with anything, and get a second pair of eyes (or a proper
audit) on the Solidity before any mainnet deployment — per the
recommendation already in Section 5.7.**

## Setup

```bash
cd Blockchain
npm install
npx hardhat compile
npm test                          # runs the 28-case test suite locally
```

To deploy to Sepolia:

```bash
cp .env.example .env
# fill in SEPOLIA_RPC_URL (e.g. from Infura/Alchemy) and
# ADMIN_WALLET_PRIVATE_KEY (a dedicated testnet-only wallet,
# funded with Sepolia test ETH from a faucet)

npm run deploy:sepolia
```

This writes the deployed address + ABI to `deployments/sepolia.json` and
prints the exact `.env` values to copy into the backend.

## The contract

`contracts/CertificateRegistry.sol` implements the four functions from
the Section 4.3.5 design (`issueCertificate`, `verifyCertificate`,
`revokeCertificate`, `certificateExists`), expanded with:

- **Multi-admin support** (`addAdmin` / `removeAdmin`, owner-only) —
  the original pseudocode assumed a single deployer wallet; in practice
  an institution needs more than one registrar staff member able to
  issue certificates.
- **Explicit revocation state** (`revoked`, `revokedAt`) rather than only
  an `exists` flag, so a revoked certificate is distinguishable from one
  that was never issued — this is what makes the audit-trail requirement
  in Section 4.3.5 actually checkable on-chain, not just in Mongo.
- **A `totalIssued` counter** and richer events, useful for the
  reporting feature (FR-A8) without needing to replay the full event log.

| Function | Access | Purpose |
|---|---|---|
| `issueCertificate(hash, certId)` | admin | Registers a certificate hash; reverts on duplicates |
| `verifyCertificate(hash)` | public | Returns exists/certId/timestamp/revoked |
| `revokeCertificate(hash)` | admin | Flags a certificate as revoked, keeps history |
| `certificateExists(hash)` | public | Lightweight existence check |
| `addAdmin(address)` / `removeAdmin(address)` | owner | Manage who can issue/revoke |

## Connecting the Sprint 4 backend

Already done — `../Backend/src/utils/blockchain.js` was updated as part of
this sprint to call this contract with `ethers.js` when
`SEPOLIA_RPC_URL`, `CONTRACT_ADDRESS` and `ADMIN_WALLET_PRIVATE_KEY` are
all set in the backend's `.env`. Steps:

1. Deploy this contract (`npm run deploy:sepolia` above).
2. Copy `deployments/sepolia.json`'s `abi` field into
  `../Backend/src/utils/CertificateRegistry.abi.json`'s `abi` field,
   **replacing the hand-authored placeholder that's there now** — that
   placeholder was written by reading the Solidity source directly,
   since no compiler was available to generate the real one. It should
   be structurally correct, but a compiler-generated ABI is the one to
   trust in production.
3. Copy the `CONTRACT_ADDRESS`, `SEPOLIA_RPC_URL` and
   `ADMIN_WALLET_PRIVATE_KEY` the deploy script printed into
  `../Backend/.env`.
4. Restart the backend. `src/utils/blockchain.js` will detect all three
   variables are set and switch from simulation to real on-chain calls —
   no code changes needed, and every stored `BlockchainTransaction` will
   now have `simulated: false`.

If any of the three variables are missing, the backend keeps working
exactly as it did in Sprint 4 (simulated transactions, clearly flagged),
so there's no hard dependency on the contract being deployed yet.

## Project structure

```
Blockchain/
├── contracts/
│   └── CertificateRegistry.sol
├── scripts/
│   ├── deploy.js          Deploys + writes deployments/<network>.json
│   └── verify.js           Etherscan source verification (optional)
├── test/
│   └── CertificateRegistry.test.js   28 cases — see caveat above
├── deployments/            Populated after a real deploy
├── hardhat.config.js
├── .env.example
└── package.json
```

## Next steps: Sprint 6

Sprint 6 (Testing & Deployment) runs the full test matrix from Section
4.5 — unit, integration, system, user acceptance, security and
performance testing — across all three layers (this contract, the
Sprint 4 backend, and the Sprint 3 frontend) working together end to
end, and prepares the system for the final defense/demo.
