const test = require("node:test");
const assert = require("node:assert/strict");
const { generateCertificateHash, sha256Hex, buildCanonicalString } = require("../src/utils/hash");

test("sha256Hex produces a 64-character hex digest", () => {
  const digest = sha256Hex("hello world");
  assert.equal(digest.length, 64);
  assert.match(digest, /^[0-9a-f]{64}$/);
});

test("sha256Hex is deterministic for the same input", () => {
  const a = sha256Hex("certificate-content");
  const b = sha256Hex("certificate-content");
  assert.equal(a, b);
});

test("sha256Hex changes if a single character changes (tamper detection, Section 3.8)", () => {
  const original = sha256Hex("Bachelor of Science in Computer Science");
  const tampered = sha256Hex("Bachelor of Science in Computer Sciencee");
  assert.notEqual(original, tampered);
});

test("buildCanonicalString is stable regardless of Date vs. string issueDate", () => {
  const fields1 = {
    certificateId: "c1",
    studentId: "s1",
    certificateNumber: "SVU-2025-0001",
    degree: "BSc",
    issueDate: new Date("2025-11-14T00:00:00.000Z"),
  };
  const fields2 = { ...fields1, issueDate: "2025-11-14" };
  assert.equal(buildCanonicalString(fields1), buildCanonicalString(fields2));
});

test("generateCertificateHash differs when certificateId differs (no collisions between otherwise-identical certs)", () => {
  const base = {
    studentId: "s1",
    certificateNumber: "SVU-2025-0001",
    degree: "BSc",
    issueDate: "2025-11-14",
  };
  const hashA = generateCertificateHash({ ...base, certificateId: "cert-a" });
  const hashB = generateCertificateHash({ ...base, certificateId: "cert-b" });
  assert.notEqual(hashA, hashB);
});
