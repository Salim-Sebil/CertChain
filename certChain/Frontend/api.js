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
  baseUrl: "http://localhost:5000/api",
  token: null,

  setToken(token) {
    this.token = token || null;
  },

  async request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};

    if (!response.ok) {
      const message = payload.message || payload.error || "Request failed.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    return payload;
  },

  /** Real endpoint: POST /api/auth/login */
  async login(email, password) {
    const data = await this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    this.setToken(data.token);
    const user = data.user;
    return {
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      studentId: user.studentId || null,
      mustChangePassword: !!user.mustChangePassword,
    };
  },

  async setPassword(password) {
    const data = await this.request("/auth/set-password", {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    return data;
  },

  async setPasswordWithResetToken(token, password) {
    const data = await this.request("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    });
    return data;
  },

  /** Real endpoint: POST /api/students */
  async registerStudent({ name, email, studentNumber, programme, department, graduationYear, temporaryPassword }) {
    const data = await this.request("/students", {
      method: "POST",
      body: JSON.stringify({ name, email, studentNumber, programme, department, graduationYear, temporaryPassword }),
    });

    const student = data.student;
    DB.users.push({
      userId: student.userId,
      name,
      email,
      password: temporaryPassword || "changeme123",
      role: "student",
      studentId: student.studentId,
    });
    DB.students.push({
      studentId: student.studentId,
      userId: student.userId,
      studentNumber,
      programme,
      department,
      graduationYear: Number(graduationYear),
    });
    return {
      studentId: student.studentId,
      userId: student.userId,
      temporaryPassword: data.temporaryPassword,
      resetLink: data.resetLink,
    };
  },

  /** Real endpoint: POST /api/certificates/issue */
  async issueCertificate({ studentId, degree, issueDate }) {
    const data = await this.request("/certificates/issue", {
      method: "POST",
      body: JSON.stringify({ studentId, degree, issueDate }),
    });

    const certificate = data.certificate;
    DB.certificates.push({
      certificateId: certificate.certificateId,
      studentId: certificate.studentId,
      studentName: certificate.studentName,
      certificateNumber: certificate.certificateNumber,
      degree: certificate.degree,
      issueDate: certificate.issueDate,
      hash: certificate.hash,
      status: certificate.status,
      qrCode: certificate.qrCode,
    });

    if (certificate.transaction) {
      DB.blockchainTransactions.push({
        txId: certificate.transaction.txHash,
        certificateId: certificate.certificateId,
        txHash: certificate.transaction.txHash,
        blockNumber: certificate.transaction.blockNumber,
        contractAddress: certificate.transaction.contractAddress,
        timestamp: new Date().toISOString(),
      });
    }

    return { ...certificate };
  },

  /** Real endpoint: GET /api/certificates?studentId=... */
  async getCertificatesForStudent(studentId) {
    const data = await this.request(`/certificates?studentId=${encodeURIComponent(studentId)}`);
    DB.certificates = data.certificates || [];
    DB.certificates.forEach(certificate => this.cacheTransaction(certificate));
    return DB.certificates;
  },

  /** Real endpoint: GET /api/certificates (admin, all records) */
  async getAllCertificates() {
    const data = await this.request("/certificates");
    DB.certificates = data.certificates || [];
    DB.certificates.forEach(certificate => this.cacheTransaction(certificate));
    return [...DB.certificates].sort((a, b) => (a.issueDate < b.issueDate ? 1 : -1));
  },

  cacheTransaction(certificate) {
    if (!certificate.transaction) return;
    const transaction = {
      txId: certificate.transaction.txHash,
      certificateId: certificate.certificateId,
      ...certificate.transaction,
      timestamp: new Date().toISOString(),
    };
    const index = DB.blockchainTransactions.findIndex(t => t.certificateId === certificate.certificateId);
    if (index >= 0) DB.blockchainTransactions[index] = transaction;
    else DB.blockchainTransactions.push(transaction);
  },

  /** Real endpoint: POST /api/certificates/:id/revoke */
  async revokeCertificate(certificateId) {
    const data = await this.request(`/certificates/${certificateId}/revoke`, {
      method: "POST",
      body: JSON.stringify({ reason: "Revoked from admin dashboard" }),
    });

    const cert = data.certificate;
    const index = DB.certificates.findIndex(c => c.certificateId === certificateId);
    if (index >= 0) DB.certificates[index].status = cert.status;
    return cert;
  },

  /** Real endpoint: POST /api/certificates/verify */
  async verifyCertificate({ certificateNumber, hash }) {
    const payload = await this.request("/certificates/verify", {
      method: "POST",
      body: JSON.stringify({ certificateNumber, hash }),
    });

    if (payload.result === "not_found") return { result: "not_found" };

    return {
      result: payload.result,
      certificate: payload.certificate,
      studentName: payload.studentName,
      transaction: payload.transaction,
    };
  },

  /** Real endpoint: GET /api/reports/summary */
  async getReportSummary() {
    const data = await this.request("/reports/summary");
    return data.summary || data;
  },
};
