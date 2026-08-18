/* ============================================================
   data.js
   In-memory data store standing in for the MongoDB collections
   defined in Section 2.15 / Table 4.1, until Sprint 4 wires the
   real Node.js + Express + MongoDB backend.

   Deliberately kept in a plain JS object (no localStorage /
   sessionStorage) so this file behaves the same whether it is
   opened directly from disk or previewed in a sandboxed frame.
   State resets on reload — that is expected for a Sprint 3
   frontend-only build.
   ============================================================ */

const DB = {
  users: [
    { userId: "u-admin-1", name: "Grace Odhiambo", email: "admin@svu.edu", password: "admin123", role: "admin" },
    { userId: "u-student-1", name: "Amina Yusuf", email: "amina.yusuf@svu.edu", password: "student123", role: "student", studentId: "s-1" },
    { userId: "u-student-2", name: "Brian Otieno", email: "brian.otieno@svu.edu", password: "student123", role: "student", studentId: "s-2" },
  ],

  students: [
    { studentId: "s-1", userId: "u-student-1", studentNumber: "SVU/2021/0142", programme: "BSc. Computer Science", department: "School of Computing", graduationYear: 2025 },
    { studentId: "s-2", userId: "u-student-2", studentNumber: "SVU/2021/0198", programme: "BSc. Information Technology", department: "School of Computing", graduationYear: 2025 },
  ],

  certificates: [],       // populated by seedCertificates()
  verificationLogs: [],   // { verificationId, certificateId, verifier, status, date }
  blockchainTransactions: [], // { txId, certificateId, txHash, blockNumber, contractAddress, timestamp }

  contractAddress: "0x8f3B" + "e1A4C2d9F0b6" + "77Ac1D45e2F9b0C3",
  nextBlock: 5_812_040,
};

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}

function pad(n) { return String(n).padStart(2, "0"); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** SHA-256 hex digest using the browser's native Web Crypto API
 *  (SubtleCrypto) — a real hash, not a simulated one. Mirrors the
 *  Node.js crypto module hashing described in Section 4.4.6; the
 *  canonical hash of record will move server-side in Sprint 4. */
async function sha256Hex(message) {
  const enc = new TextEncoder().encode(message);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function fakeTxHash() {
  const chars = "0123456789abcdef";
  let s = "0x";
  for (let i = 0; i < 64; i++) s += chars[Math.floor(Math.random() * 16)];
  return s;
}

function studentName(studentId) {
  const s = DB.students.find(x => x.studentId === studentId);
  if (!s) return "Unknown Student";
  const u = DB.users.find(x => x.userId === s.userId);
  return u ? u.name : "Unknown Student";
}

/** Seeds two already-issued certificates so the Verifier and
 *  Student views have something real to demonstrate on first load. */
async function seedCertificates() {
  const seed = [
    { studentId: "s-1", degree: "Bachelor of Science in Computer Science", programme: "BSc. Computer Science", issueDate: "2025-11-14" },
    { studentId: "s-2", degree: "Bachelor of Science in Information Technology", programme: "BSc. Information Technology", issueDate: "2025-11-14" },
  ];
  for (const s of seed) {
    await issueCertificateRecord(s.studentId, s.degree, s.issueDate);
  }
}

/** Shared record-creation logic used by both the seed step and the
 *  live "Issue Certificate" form in the admin dashboard. */
async function issueCertificateRecord(studentId, degree, issueDate) {
  const certificateId = uid("cert");
  const certificateNumber = "SVU-" + issueDate.slice(0, 4) + "-" + Math.floor(1000 + Math.random() * 9000);
  const canonical = `${certificateId}|${studentId}|${certificateNumber}|${degree}|${issueDate}`;
  const hash = await sha256Hex(canonical);

  const certificate = {
    certificateId,
    studentId,
    certificateNumber,
    degree,
    issueDate,
    hash,
    status: "valid", // valid | revoked
    qrCode: `${location.origin}${location.pathname}#/verify?cert=${certificateNumber}`,
  };
  DB.certificates.push(certificate);

  const tx = {
    txId: uid("tx"),
    certificateId,
    txHash: fakeTxHash(),
    blockNumber: DB.nextBlock++,
    contractAddress: DB.contractAddress,
    timestamp: new Date().toISOString(),
  };
  DB.blockchainTransactions.push(tx);

  return certificate;
}
