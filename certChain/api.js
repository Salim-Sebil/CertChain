/* ============================================================
   api.js
   Every function here has the exact signature and return shape
   the real Express endpoint from Table 4.2 will have. Swapping
   the body of each function for a fetch() call is Sprint 4's
   entire job — nothing in app.js should need to change.
   ============================================================ */

const API_LATENCY = 350; // ms — simulates real network/blockchain latency

function delay(ms = API_LATENCY) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const Api = {

  /** Real endpoint (Sprint 4): POST /api/auth/login */
  async login(email, password) {
    await delay();
    const user = DB.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    if (!user) {
      const err = new Error("Invalid email or password.");
      err.code = "AUTH_FAILED";
      throw err;
    }
    return { userId: user.userId, name: user.name, email: user.email, role: user.role, studentId: user.studentId || null };
  },

  /** Real endpoint (Sprint 4): POST /api/students */
  async registerStudent({ name, email, studentNumber, programme, department, graduationYear }) {
    await delay();
    if (DB.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      throw new Error("A user with this email already exists.");
    }
    const userId = uid("u-student");
    const studentId = uid("s");
    DB.users.push({ userId, name, email, password: "changeme123", role: "student", studentId });
    DB.students.push({ studentId, userId, studentNumber, programme, department, graduationYear: Number(graduationYear) });
    return { studentId, userId };
  },

  /** Real endpoint (Sprint 4): POST /api/certificates/issue */
  async issueCertificate({ studentId, degree, issueDate }) {
    await delay(600); // issuance includes blockchain registration — slower, per Table 4.5
    if (!DB.students.some(s => s.studentId === studentId)) {
      throw new Error("Selected student was not found.");
    }
    const certificate = await issueCertificateRecord(studentId, degree, issueDate);
    return certificate;
  },

  /** Real endpoint (Sprint 4): GET /api/certificates?studentId=... */
  async getCertificatesForStudent(studentId) {
    await delay();
    return DB.certificates.filter(c => c.studentId === studentId);
  },

  /** Real endpoint (Sprint 4): GET /api/certificates (admin, all records) */
  async getAllCertificates() {
    await delay();
    return [...DB.certificates].sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  },

  /** Real endpoint (Sprint 4): POST /api/certificates/:id/revoke */
  async revokeCertificate(certificateId) {
    await delay();
    const cert = DB.certificates.find(c => c.certificateId === certificateId);
    if (!cert) throw new Error("Certificate not found.");
    cert.status = "revoked";
    return cert;
  },

  /** Real endpoint (Sprint 4): POST /api/certificates/verify
   *  Accepts EITHER a certificate number OR a raw hash (from an
   *  uploaded document) — mirrors the two verifier flows in
   *  Section 4.3.4 (search vs. document upload / QR scan). */
  async verifyCertificate({ certificateNumber, hash }) {
    await delay();
    let cert = null;
    if (certificateNumber) {
      cert = DB.certificates.find(c => c.certificateNumber.toLowerCase() === certificateNumber.trim().toLowerCase());
    } else if (hash) {
      cert = DB.certificates.find(c => c.hash === hash);
    }

    const verificationId = uid("verif");
    const logEntry = {
      verificationId,
      certificateId: cert ? cert.certificateId : null,
      verifier: "Public verifier",
      status: !cert ? "not_found" : cert.status === "revoked" ? "revoked" : "valid",
      date: new Date().toISOString(),
    };
    DB.verificationLogs.push(logEntry);

    if (!cert) {
      return { result: "not_found" };
    }
    const tx = DB.blockchainTransactions.find(t => t.certificateId === cert.certificateId);
    return {
      result: cert.status === "revoked" ? "revoked" : "valid",
      certificate: cert,
      studentName: studentName(cert.studentId),
      transaction: tx,
    };
  },

  /** Real endpoint (Sprint 4): GET /api/reports/summary */
  async getReportSummary() {
    await delay();
    const byProgramme = {};
    DB.certificates.forEach(c => {
      const s = DB.students.find(x => x.studentId === c.studentId);
      const key = (s && s.programme) || "Unclassified";
      byProgramme[key] = (byProgramme[key] || 0) + 1;
    });
    return {
      totalCertificates: DB.certificates.length,
      totalRevoked: DB.certificates.filter(c => c.status === "revoked").length,
      totalStudents: DB.students.length,
      totalVerifications: DB.verificationLogs.length,
      byProgramme,
    };
  },
};
