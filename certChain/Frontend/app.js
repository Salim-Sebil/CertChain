/* ============================================================
   app.js
   Hash-based router + view renderers. Pure DOM manipulation,
   no framework, per the Presentation Layer decision in
   Section 2.14 / 4.4.2. Session state lives in the `currentUser`
   variable only — deliberately not persisted to storage, so this
   file behaves identically on disk or in a sandboxed preview.
   ============================================================ */

const app = document.getElementById("app");
let currentUser = null; // { userId, name, email, role, studentId }

/* Bumped on every navigation. Async view code captures the token at
   the start of a render and checks it before writing to the DOM after
   an await, so a slow response can never paint over a view the user
   has since navigated away from. */
let renderToken = 0;

/* ---------------- Toast ---------------- */

let toastTimer = null;
function toast(message, isError = false) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.toggle("toast-error", isError);
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

/* ---------------- Modal ---------------- */

function showModal(innerHtml) {
  closeModal();
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.id = "modal-overlay";
  overlay.innerHTML = `<div class="modal">${innerHtml}</div>`;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
  return overlay;
}
function closeModal() {
  const existing = document.getElementById("modal-overlay");
  if (existing) existing.remove();
}

/* ---------------- Router ---------------- */

function parseHash() {
  const raw = location.hash.slice(1) || "/verify";
  const [path, queryString] = raw.split("?");
  const params = new URLSearchParams(queryString || "");
  return { path: path.replace(/^\//, "") || "verify", params };
}

function updateNavActive(path) {
  document.querySelectorAll(".topnav a[data-route]").forEach(a => {
    a.classList.toggle("active", a.dataset.route === path);
  });
}

function updateSessionSlot() {
  const slot = document.getElementById("session-slot");
  document.querySelectorAll(".role-admin-only").forEach(el => el.style.display = currentUser?.role === "admin" ? "inline" : "none");
  document.querySelectorAll(".role-student-only").forEach(el => el.style.display = currentUser?.role === "student" ? "inline" : "none");

  if (currentUser) {
    slot.innerHTML = `
      <span class="session-chip">${escapeHtml(currentUser.name)} &middot; ${currentUser.role}</span>
      <button class="btn-logout" id="btn-logout">Log out</button>`;
    document.getElementById("btn-logout").addEventListener("click", () => {
      currentUser = null;
      toast("You have been logged out.");
      location.hash = "/verify";
    });
  } else {
    slot.innerHTML = `<a href="#/login" class="btn-logout" style="text-decoration:none;">Log in</a>`;
  }
}

async function renderRoute() {
  renderToken++;
  const { path, params } = parseHash();

  if (path === "admin" && currentUser?.role !== "admin") {
    toast("Please log in as an administrator to continue.", true);
    location.hash = "/login";
    return;
  }
  if (path === "student" && currentUser?.role !== "student") {
    toast("Please log in as a student to continue.", true);
    location.hash = "/login";
    return;
  }

  updateNavActive(path);
  updateSessionSlot();
  window.scrollTo(0, 0);

  if (path === "login") return renderLogin();
  if (path === "set-password") {
    const resetToken = params.get("token");
    if (!currentUser && !resetToken) {
      toast("Please log in to set your password.", true);
      location.hash = "/login";
      return;
    }
    return renderSetPassword(resetToken || null);
  }
  if (path === "admin") return renderAdmin();
  if (path === "student") return renderStudent();
  return renderVerify(params);
}

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", async () => {
  await seedCertificates();
  renderRoute();
});

/* ---------------- Small helpers ---------------- */

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function statusBadge(status) {
  if (status === "revoked") return `<span class="badge badge-revoked">Revoked</span>`;
  return `<span class="badge badge-valid">Valid</span>`;
}

/* ================================================================
   VIEW: Login
   ================================================================ */

function renderLogin() {
  app.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <span class="eyebrow" style="text-align:center;display:block;">Institution &amp; Student Access</span>
        <h1>Sign in to CertChain</h1>
        <p class="card-desc">Administrators issue and manage certificates here. Students view and share theirs. Verifiers don't need an account — see <a href="#/verify">Verify a Certificate</a>.</p>
        <div id="login-error"></div>
        <form id="login-form">
          <div class="field">
            <label for="login-email">Email</label>
            <input type="email" id="login-email" required placeholder="you@svu.edu">
          </div>
          <div class="field">
            <label for="login-password">Password</label>
            <input type="password" id="login-password" required placeholder="••••••••">
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;" id="login-submit">Sign In</button>
        </form>
        <div class="demo-accounts">
          Demo accounts — <button type="button" data-demo="admin">fill admin</button> &middot;
          <button type="button" data-demo="student">fill student</button>
        </div>
      </div>
    </div>`;

  document.querySelectorAll("[data-demo]").forEach(btn => {
    btn.addEventListener("click", () => {
      const which = btn.dataset.demo;
      const creds = which === "admin"
        ? { email: "admin@svu.edu", password: "admin123" }
        : { email: "amina.yusuf@svu.edu", password: "student123" };
      document.getElementById("login-email").value = creds.email;
      document.getElementById("login-password").value = creds.password;
    });
  });

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    const submitBtn = document.getElementById("login-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Signing in…";
    try {
      const user = await Api.login(email, password);
      currentUser = user;
      if (user.mustChangePassword) {
        toast("Please set a new password to continue.");
        location.hash = "/set-password";
        return;
      }
      toast(`Welcome back, ${user.name.split(" ")[0]}.`);
      location.hash = user.role === "admin" ? "/admin" : "/student";
    } catch (err) {
      document.getElementById("login-error").innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = "Sign In";
    }
  });
}

function renderSetPassword(resetToken = null) {
  app.innerHTML = `
    <div class="login-shell">
      <div class="login-card">
        <span class="eyebrow" style="text-align:center;display:block;">Set Your Password</span>
        <h1>Choose a new password</h1>
        <p class="card-desc">This password will be used for your future sign-ins. Use at least 8 characters.</p>
        <div id="set-password-error"></div>
        <form id="set-password-form">
          <div class="field">
            <label for="new-password">New password</label>
            <input type="password" id="new-password" required minLength="8" placeholder="Create a strong password">
          </div>
          <div class="field">
            <label for="confirm-password">Confirm password</label>
            <input type="password" id="confirm-password" required minLength="8" placeholder="Re-enter your password">
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center;">Save Password</button>
        </form>
      </div>
    </div>`;

  document.getElementById("set-password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const newPassword = document.getElementById("new-password").value;
    const confirmPassword = document.getElementById("confirm-password").value;
    const errorBox = document.getElementById("set-password-error");

    if (newPassword !== confirmPassword) {
      errorBox.innerHTML = '<div class="error-msg">Passwords do not match.</div>';
      return;
    }

    try {
      if (resetToken) {
        await Api.setPasswordWithResetToken(resetToken, newPassword);
        currentUser = null;
        toast("Password reset successful. Please sign in with your new password.");
        location.hash = "/login";
      } else {
        await Api.setPassword(newPassword);
        currentUser.mustChangePassword = false;
        toast("Password updated successfully.");
        location.hash = currentUser.role === "admin" ? "/admin" : "/student";
      }
    } catch (err) {
      errorBox.innerHTML = `<div class="error-msg">${escapeHtml(err.message)}</div>`;
    }
  });
}

/* ================================================================
   VIEW: Admin Dashboard
   ================================================================ */

async function renderAdmin() {
  const myToken = renderToken;
  const [certificates, summary] = await Promise.all([Api.getAllCertificates(), Api.getReportSummary()]);
  if (myToken !== renderToken) return; // user navigated away while this was loading

  app.innerHTML = `
    <div class="view-header">
      <span class="eyebrow">Institution Administrator</span>
      <h1>Admin Dashboard</h1>
      <p>Register students, issue blockchain-backed certificates, and manage the institution's certificate ledger.</p>
    </div>

    <div class="grid-3" style="margin-bottom:28px;" id="stat-tiles">
      ${statTilesHtml(summary)}
    </div>

    <div class="tabs">
      <button class="tab-btn active" data-tab="issue">Issue Certificate</button>
      <button class="tab-btn" data-tab="register">Register Student</button>
      <button class="tab-btn" data-tab="ledger">Certificate Ledger</button>
      <button class="tab-btn" data-tab="reports">Reports</button>
    </div>

    <div class="tab-panel active" data-panel="issue">
      <div class="card">
        <h2>Issue a certificate</h2>
        <p class="card-desc">Generates a SHA-256 hash of the certificate and registers it on-chain via <code>issueCertificate()</code>, per Section 4.3.5.</p>
        <form id="issue-form">
          <div class="field">
            <label for="issue-student">Student</label>
            <select id="issue-student" required>
              <option value="">Select a registered student…</option>
              ${DB.students.map(s => `<option value="${s.studentId}">${escapeHtml(studentName(s.studentId))} — ${escapeHtml(s.studentNumber)}</option>`).join("")}
            </select>
          </div>
          <div class="field">
            <label for="issue-degree">Degree / Award title</label>
            <input type="text" id="issue-degree" required placeholder="e.g. Bachelor of Science in Computer Science">
          </div>
          <div class="field">
            <label for="issue-date">Issue date</label>
            <input type="date" id="issue-date" required value="${todayISO()}">
          </div>
          <button class="btn btn-primary" type="submit" id="issue-submit">Generate Hash &amp; Issue on Blockchain</button>
        </form>
      </div>
    </div>

    <div class="tab-panel" data-panel="register">
      <div class="card">
        <h2>Register a student</h2>
        <p class="card-desc">Adds the student to the Students collection so they can be selected during issuance (Section 4.3.2).</p>
        <form id="register-form">
          <div class="form-row">
            <div class="field"><label for="reg-name">Full name</label><input type="text" id="reg-name" required></div>
            <div class="field"><label for="reg-email">Email</label><input type="email" id="reg-email" required></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="reg-number">Student number</label><input type="text" id="reg-number" required placeholder="1030903"></div>
            <div class="field"><label for="reg-year">Graduation year</label><input type="number" id="reg-year" required value="${new Date().getFullYear()}" min="2000" max="2100"></div>
          </div>
          <div class="form-row">
            <div class="field"><label for="reg-programme">Programme</label><input type="text" id="reg-programme" required placeholder="BSc. Computer Science"></div>
            <div class="field"><label for="reg-department">Department</label><input type="text" id="reg-department" required placeholder="School of Computing"></div>
          </div>
          <div class="field">
            <label for="reg-password">Temporary password (optional)</label>
            <input type="text" id="reg-password" placeholder="Leave blank to auto-generate one">
          </div>
          <button class="btn btn-primary" type="submit">Register Student</button>
        </form>
      </div>
    </div>

    <div class="tab-panel" data-panel="ledger">
      <div class="card">
        <div class="flex-between">
          <div><h2 class="mt-0">Certificate ledger</h2><p class="card-desc mt-0">Search, review and revoke issued certificates.</p></div>
        </div>
        <div class="search-row">
          <input type="text" id="ledger-search" placeholder="Search by certificate number or student name…">
        </div>
        <div id="ledger-table"></div>
      </div>
    </div>

    <div class="tab-panel" data-panel="reports">
      <div class="card">
        <h2>Certificates by programme</h2>
        <p class="card-desc">Computed live from the certificate ledger.</p>
        <div id="report-bars"></div>
      </div>
    </div>
  `;

  wireTabs();
  wireIssueForm();
  wireRegisterForm();
  renderLedgerTable(certificates);
  document.getElementById("ledger-search").addEventListener("input", async (e) => {
    const q = e.target.value.trim().toLowerCase();
    const all = await Api.getAllCertificates();
    const filtered = !q ? all : all.filter(c =>
      c.certificateNumber.toLowerCase().includes(q) || certificateStudentName(c).toLowerCase().includes(q));
    renderLedgerTable(filtered);
  });
  renderReportBars(summary);
}

function statTilesHtml(summary) {
  return `
    <div class="stat-tile"><span class="stat-num">${summary.totalCertificates}</span><span class="stat-label">Certificates issued</span></div>
    <div class="stat-tile"><span class="stat-num">${summary.totalRevoked}</span><span class="stat-label">Revoked</span></div>
    <div class="stat-tile"><span class="stat-num">${summary.totalVerifications}</span><span class="stat-label">Verification checks</span></div>`;
}

async function refreshAdminSummary() {
  const myToken = renderToken;
  const summary = await Api.getReportSummary();
  if (myToken !== renderToken) return; // user navigated away while this was loading
  const tilesEl = document.getElementById("stat-tiles");
  if (tilesEl) tilesEl.innerHTML = statTilesHtml(summary);
  renderReportBars(summary);
}

function wireTabs() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach(btn => {
    btn.addEventListener("click", () => {
      tabs.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      document.querySelector(`.tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add("active");
    });
  });
}

function wireIssueForm() {
  document.getElementById("issue-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById("issue-submit");
    submitBtn.disabled = true;
    submitBtn.textContent = "Registering on Sepolia testnet…";
    try {
      const studentId = document.getElementById("issue-student").value;
      const degree = document.getElementById("issue-degree").value;
      const issueDate = document.getElementById("issue-date").value;
      const cert = await Api.issueCertificate({ studentId, degree, issueDate });
      toast(`Certificate ${cert.certificateNumber} issued and hashed on-chain.`);
      e.target.reset();
      document.getElementById("issue-date").value = todayISO();
      document.querySelector('.tab-btn[data-tab="ledger"]').click();
      renderLedgerTable(await Api.getAllCertificates());
      await refreshAdminSummary();
    } catch (err) {
      toast(err.message, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Generate Hash & Issue on Blockchain";
    }
  });
}

function wireRegisterForm() {
  document.getElementById("register-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const temporaryPassword = document.getElementById("reg-password").value.trim();
      const result = await Api.registerStudent({
        name: document.getElementById("reg-name").value,
        email: document.getElementById("reg-email").value,
        studentNumber: document.getElementById("reg-number").value,
        graduationYear: document.getElementById("reg-year").value,
        programme: document.getElementById("reg-programme").value,
        department: document.getElementById("reg-department").value,
        temporaryPassword: temporaryPassword || undefined,
      });

      const resetMessage = result.resetLink
        ? `Student registered. Temporary password: ${result.temporaryPassword}. Password reset link sent to ${document.getElementById("reg-email").value}: ${result.resetLink}`
        : (result.temporaryPassword ? `Student registered. Temporary password: ${result.temporaryPassword}` : "Student registered. They can now be selected during issuance.");
      toast(resetMessage);
      e.target.reset();
      document.getElementById("issue-student").innerHTML =
        `<option value="">Select a registered student…</option>` +
        DB.students.map(s => `<option value="${s.studentId}">${escapeHtml(studentName(s.studentId))} — ${escapeHtml(s.studentNumber)}</option>`).join("");
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function renderLedgerTable(certificates) {
  const container = document.getElementById("ledger-table");
  if (!container) return; // user navigated away
  if (!certificates.length) {
    container.innerHTML = `<div class="empty-state"><span class="eyebrow">No results</span>No certificates match your search yet.</div>`;
    return;
  }
  container.innerHTML = `
    <div class="table-scroll">
    <table>
      <thead><tr><th>Certificate No.</th><th>Student</th><th>Degree</th><th>Issued</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${certificates.map(c => `
          <tr>
            <td class="mono">${escapeHtml(c.certificateNumber)}</td>
            <td>${escapeHtml(certificateStudentName(c))}</td>
            <td>${escapeHtml(c.degree)}</td>
            <td>${fmtDate(c.issueDate)}</td>
            <td>${statusBadge(c.status)}</td>
            <td>
              ${c.status === "valid"
                ? `<button class="btn btn-danger btn-sm" data-revoke="${c.certificateId}">Revoke</button>`
                : `<span class="text-dim">—</span>`}
            </td>
          </tr>`).join("")}
      </tbody>
    </table>
    </div>`;

  container.querySelectorAll("[data-revoke]").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (!confirm("Revoke this certificate? This cannot be undone, and the historical record will be preserved for audit, per Section 4.3.5.")) return;
      try {
        await Api.revokeCertificate(btn.dataset.revoke);
        toast("Certificate revoked.");
        renderLedgerTable(await Api.getAllCertificates());
        await refreshAdminSummary();
      } catch (err) {
        toast(err.message, true);
      }
    });
  });
}

function certificateStudentName(certificate) {
  return certificate.studentName || studentName(certificate.studentId);
}

function renderReportBars(summary) {
  const container = document.getElementById("report-bars");
  if (!container) return; // user navigated away
  const entries = Object.entries(summary.byProgramme);
  if (!entries.length) {
    container.innerHTML = `<div class="empty-state">No certificates issued yet.</div>`;
    return;
  }
  const max = Math.max(...entries.map(([, n]) => n));
  container.innerHTML = entries.map(([programme, n]) => `
    <div class="bar-row">
      <div class="bar-label">${escapeHtml(programme)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${(n / max) * 100}%"></div></div>
      <div class="bar-count">${n}</div>
    </div>`).join("");
}

/* ================================================================
   VIEW: Student Dashboard
   ================================================================ */

async function renderStudent() {
  const myToken = renderToken;
  const certificates = await Api.getCertificatesForStudent(currentUser.studentId);
  const student = DB.students.find(s => s.studentId === currentUser.studentId);
  if (myToken !== renderToken) return; // user navigated away while this was loading

  app.innerHTML = `
    <div class="view-header">
      <span class="eyebrow">Student</span>
      <h1>Welcome, ${escapeHtml(currentUser.name.split(" ")[0])}</h1>
      <p>${escapeHtml(student?.programme || "")} &middot; ${escapeHtml(student?.studentNumber || "")}</p>
    </div>

    <div id="cert-list">
      ${certificates.length ? "" : `<div class="empty-state card"><span class="eyebrow">No certificates yet</span>Certificates issued to you by the institution will appear here.</div>`}
      ${certificates.map(c => `
        <div class="cert-card">
          <span class="cert-number">${escapeHtml(c.certificateNumber)}</span>
          <h3>${escapeHtml(c.degree)}</h3>
          <div class="cert-meta">Issued ${fmtDate(c.issueDate)} &middot; ${statusBadge(c.status)}</div>
          <div class="cert-actions">
            <button class="btn btn-outline btn-sm" data-qr="${c.certificateId}">Show QR Code</button>
            <button class="btn btn-outline btn-sm" data-tx="${c.certificateId}">View Blockchain Transaction</button>
            <button class="btn btn-gold btn-sm" data-download="${c.certificateId}">Download Certificate</button>
          </div>
        </div>
      `).join("")}
    </div>

    <div class="card">
      <h2>Profile</h2>
      <p class="card-desc">Update your contact details on file with the institution.</p>
      <form id="profile-form">
        <div class="form-row">
          <div class="field"><label for="profile-name">Full name</label><input type="text" id="profile-name" value="${escapeHtml(currentUser.name)}" required></div>
          <div class="field"><label for="profile-email">Email</label><input type="email" id="profile-email" value="${escapeHtml(currentUser.email)}" required></div>
        </div>
        <button class="btn btn-primary" type="submit">Save Changes</button>
      </form>
    </div>
  `;

  document.querySelectorAll("[data-qr]").forEach(btn => btn.addEventListener("click", () => openQrModal(btn.dataset.qr)));
  document.querySelectorAll("[data-tx]").forEach(btn => btn.addEventListener("click", () => openTxModal(btn.dataset.tx)));
  document.querySelectorAll("[data-download]").forEach(btn => btn.addEventListener("click", () => downloadCertificate(btn.dataset.download)));

  document.getElementById("profile-form").addEventListener("submit", (e) => {
    e.preventDefault();
    currentUser.name = document.getElementById("profile-name").value;
    currentUser.email = document.getElementById("profile-email").value;
    const userRecord = DB.users.find(u => u.userId === currentUser.userId);
    if (userRecord) { userRecord.name = currentUser.name; userRecord.email = currentUser.email; }
    updateSessionSlot();
    toast("Profile updated.");
  });
}

function openQrModal(certificateId) {
  const cert = DB.certificates.find(c => c.certificateId === certificateId);
  const overlay = showModal(`
    <h3>Certificate QR Code</h3>
    <span class="cert-number">${escapeHtml(cert.certificateNumber)}</span>
    <div id="qr-target"></div>
    <p class="text-dim" style="font-size:12.5px;">Scanning this code opens the verifier page pre-filled with this certificate.</p>
    <button class="modal-close" id="modal-close-btn">Close</button>
  `);
  const target = overlay.querySelector("#qr-target");
  const verificationUrl = `${location.origin}${location.pathname}#/verify?cert=${encodeURIComponent(cert.certificateNumber)}`;
  if (cert.qrCode && cert.qrCode.startsWith("data:image/")) {
    const image = document.createElement("img");
    image.src = cert.qrCode;
    image.alt = `QR code for ${cert.certificateNumber}`;
    image.width = 176;
    image.height = 176;
    target.appendChild(image);
  } else if (typeof QRCode === "function") {
    new QRCode(target, { text: verificationUrl, width: 176, height: 176, colorDark: "#14213D", colorLight: "#ffffff" });
  } else {
    target.innerHTML = `<p class="text-dim">QR library unavailable offline — certificate number above can be entered manually.</p>`;
  }
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
}

function openTxModal(certificateId) {
  const cert = DB.certificates.find(c => c.certificateId === certificateId);
  const tx = DB.blockchainTransactions.find(t => t.certificateId === certificateId);
  if (!cert || !tx) {
    toast("Blockchain transaction details are unavailable.", true);
    return;
  }
  showModal(`
    <h3>Blockchain Transaction</h3>
    <span class="cert-number">${escapeHtml(cert.certificateNumber)}</span>
    <div class="detail-list" style="text-align:left;">
      <div><dt>Transaction hash</dt><dd>${escapeHtml(tx.txHash)}</dd></div>
      <div><dt>Block number</dt><dd>${tx.blockNumber}</dd></div>
      <div><dt>Contract address</dt><dd>${escapeHtml(tx.contractAddress)}</dd></div>
      <div><dt>Network</dt><dd>Ethereum Sepolia (testnet)</dd></div>
      <div><dt>Certificate hash</dt><dd>${escapeHtml(cert.hash)}</dd></div>
    </div>
    <button class="modal-close" id="modal-close-btn">Close</button>
  `);
  document.getElementById("modal-close-btn").addEventListener("click", closeModal);
}

function downloadCertificate(certificateId) {
  const cert = DB.certificates.find(c => c.certificateId === certificateId);
  const tx = DB.blockchainTransactions.find(t => t.certificateId === certificateId);
  if (!cert) {
    toast("Certificate could not be found.", true);
    return;
  }
  if (!window.jspdf?.jsPDF) {
    toast("PDF generator is unavailable. Check your internet connection and try again.", true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const student = certificateStudentName(cert);
  const status = cert.status === "revoked" ? "REVOKED" : "VALID";

  pdf.setFillColor(250, 247, 240);
  pdf.rect(0, 0, width, height, "F");
  pdf.setDrawColor(184, 144, 63);
  pdf.setLineWidth(1.1);
  pdf.rect(12, 12, width - 24, height - 24);
  pdf.setLineWidth(0.35);
  pdf.rect(15, 15, width - 30, height - 30);

  pdf.setTextColor(20, 33, 61);
  pdf.setFont("times", "bold");
  pdf.setFontSize(13);
  pdf.text("CERTCHAIN", width / 2, 31, { align: "center" });
  pdf.setTextColor(184, 144, 63);
  pdf.setFontSize(10);
  pdf.text("BLOCKCHAIN-BASED CERTIFICATE VERIFICATION", width / 2, 38, { align: "center" });

  pdf.setTextColor(20, 33, 61);
  pdf.setFont("times", "normal");
  pdf.setFontSize(30);
  pdf.text("Certificate of Achievement", width / 2, 61, { align: "center" });
  pdf.setTextColor(70, 67, 58);
  pdf.setFontSize(12);
  pdf.text("This certifies that", width / 2, 76, { align: "center" });
  pdf.setTextColor(20, 33, 61);
  pdf.setFont("times", "bold");
  pdf.setFontSize(24);
  pdf.text(student, width / 2, 90, { align: "center", maxWidth: width - 90 });
  pdf.setDrawColor(184, 144, 63);
  pdf.line(58, 96, width - 58, 96);
  pdf.setFont("times", "normal");
  pdf.setFontSize(14);
  pdf.text(`has been awarded ${cert.degree}`, width / 2, 108, { align: "center", maxWidth: width - 76 });
  pdf.setFontSize(11);
  pdf.text(`Issued ${fmtDate(cert.issueDate)}`, width / 2, 119, { align: "center" });

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(20, 33, 61);
  pdf.text(`Certificate Number: ${cert.certificateNumber}`, 25, 137);
  pdf.setTextColor(cert.status === "revoked" ? 161 : 47, cert.status === "revoked" ? 61 : 104, cert.status === "revoked" ? 46 : 68);
  pdf.text(`Status: ${status}`, 25, 145);
  pdf.setTextColor(20, 33, 61);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("Verification Hash:", 25, 155);
  pdf.text(pdf.splitTextToSize(cert.hash, width - 78), 25, 160);
  if (tx?.txHash) {
    pdf.setFontSize(7);
    pdf.text(`Blockchain Transaction: ${tx.txHash}`, 25, 172, { maxWidth: width - 78 });
  }
  if (cert.qrCode?.startsWith("data:image/")) {
    try {
      pdf.addImage(cert.qrCode, "PNG", width - 53, 132, 28, 28);
    } catch {
      // QR image formats can vary; the certificate remains verifiable by hash.
    }
  }
  pdf.setFontSize(8);
  pdf.setTextColor(107, 101, 88);
  pdf.text("Verify this certificate at the CertChain public verification page.", width / 2, height - 22, { align: "center" });

  pdf.save(`${cert.certificateNumber}.pdf`);
  toast("Certificate PDF downloaded.");
}

/* ================================================================
   VIEW: Verifier (public — no login required)
   ================================================================ */

function renderVerify(params) {
  const prefill = params?.get("cert") || "";
  app.innerHTML = `
    <div class="view-header">
      <span class="eyebrow">Public &middot; No account needed</span>
      <h1>Verify a Certificate</h1>
      <p>Check any certificate issued through CertChain against its immutable blockchain record — by certificate number, uploaded certificate file, or QR scan.</p>
    </div>

    <div class="card">
      <h2>Search by certificate number</h2>
      <div class="search-row">
        <input type="text" id="verify-input" placeholder="e.g. SVU-2025-1234" value="${escapeHtml(prefill)}">
        <button class="btn btn-primary" id="verify-btn">Verify</button>
      </div>

      <div class="divider-or">or</div>

      <div class="grid-2">
        <div>
          <label for="verify-upload">Upload certificate file</label>
          <input type="file" id="verify-upload" accept=".pdf,.json,.txt">
          <p class="field-hint">Upload a downloaded certificate PDF or JSON file to verify its embedded hash.</p>
        </div>
        <div>
          <label>Scan QR code</label>
          <button class="btn btn-outline" id="scan-btn" type="button" style="width:100%;justify-content:center;">Open Camera Scanner</button>
          <p class="field-hint">Requires camera access. Falls back gracefully if unavailable.</p>
        </div>
      </div>
    </div>

    <div id="verify-result"></div>
  `;

  document.getElementById("verify-btn").addEventListener("click", () => runVerification({ certificateNumber: document.getElementById("verify-input").value }));
  document.getElementById("verify-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runVerification({ certificateNumber: e.target.value });
  });
  document.getElementById("verify-upload").addEventListener("change", handleFileUpload);
  document.getElementById("scan-btn").addEventListener("click", openScanner);

  if (prefill) runVerification({ certificateNumber: prefill });
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    if (!window.pdfjsLib) {
      toast("PDF reader is unavailable. Check your internet connection and try again.", true);
      return;
    }
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    try {
      const document = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const pages = await Promise.all(Array.from({ length: document.numPages }, async (_, index) => {
        const page = await document.getPage(index + 1);
        const content = await page.getTextContent();
        return content.items.map(item => item.str).join(" ");
      }));
      const text = pages.join(" ");
      const hash = text.match(/\b[0-9a-f]{64}\b/i)?.[0];
      const certificateNumber = text.match(/\bSVU-\d{4}-\d{4}\b/i)?.[0];
      if (hash) return runVerification({ hash });
      if (certificateNumber) return runVerification({ certificateNumber });
    } catch {
      toast("Could not read that PDF certificate.", true);
      return;
    }
    toast("Could not find a certificate hash or number in that PDF.", true);
    return;
  }

  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    if (parsed.hash) return runVerification({ hash: parsed.hash });
    if (parsed.certificateNumber) return runVerification({ certificateNumber: parsed.certificateNumber });
  } catch {
    /* not JSON — fall through */
  }
  toast("Could not read a certificate hash from that file.", true);
}

function openScanner() {
  const overlay = showModal(`
    <h3>Scan Certificate QR Code</h3>
    <div id="scan-region"></div>
    <p class="scan-note" id="scan-status">Requesting camera access…</p>
    <button class="modal-close" id="modal-close-btn">Cancel</button>
  `);
  document.getElementById("modal-close-btn").addEventListener("click", () => { stopScanner(); closeModal(); });

  loadScannerLib()
    .then(() => startScanner(overlay))
    .catch(() => {
      overlay.querySelector("#scan-status").textContent =
        "Camera scanning isn't available in this environment. Enter the certificate number above instead.";
    });
}

let scannerInstance = null;
function loadScannerLib() {
  return new Promise((resolve, reject) => {
    if (window.Html5Qrcode) return resolve();
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html5-qrcode/2.3.8/html5-qrcode.min.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
function startScanner(overlay) {
  const statusEl = overlay.querySelector("#scan-status");
  scannerInstance = new Html5Qrcode("scan-region");
  scannerInstance.start(
    { facingMode: "environment" },
    { fps: 10, qrbox: 220 },
    (decodedText) => {
      const match = decodedText.match(/cert=([A-Za-z0-9-]+)/);
      const certificateNumber = match ? match[1] : decodedText;
      stopScanner();
      closeModal();
      document.getElementById("verify-input").value = certificateNumber;
      runVerification({ certificateNumber });
    },
    () => { /* per-frame scan miss — ignore */ }
  ).catch(() => {
    statusEl.textContent = "Camera access was denied or is unavailable. Enter the certificate number above instead.";
  });
}
function stopScanner() {
  if (scannerInstance) {
    scannerInstance.stop().catch(() => {});
    scannerInstance = null;
  }
}

async function runVerification(query) {
  const myToken = renderToken;
  const resultEl = document.getElementById("verify-result");
  if (!resultEl) return;
  resultEl.innerHTML = `<div class="card text-dim">Checking against the blockchain record…</div>`;
  const res = await Api.verifyCertificate(query);
  if (myToken !== renderToken) return; // user navigated away while this was loading
  const freshResultEl = document.getElementById("verify-result");
  if (freshResultEl) freshResultEl.innerHTML = renderVerifyResult(res, query);
}

function renderVerifyResult(res, query) {
  if (res.result === "not_found") {
    return `
      <div class="card">
        <div class="result-panel">
          <div class="seal-badge invalid">${sealIcon("x")}</div>
          <div>
            <div class="result-title invalid">Not Found</div>
            <p class="text-dim">No certificate matches "${escapeHtml(query.certificateNumber || "the uploaded file")}". Check the certificate number and try again.</p>
          </div>
        </div>
      </div>`;
  }

  const isRevoked = res.result === "revoked";
  const cert = res.certificate;
  return `
    <div class="card">
      <div class="result-panel">
        <div class="seal-badge ${isRevoked ? "revoked" : "valid"}">${sealIcon(isRevoked ? "x" : "check")}</div>
        <div>
          <div class="result-title ${isRevoked ? "revoked" : "valid"}">${isRevoked ? "Revoked" : "Valid Certificate"}</div>
          <p class="text-dim">${isRevoked
            ? "This certificate was issued but has since been revoked by the institution."
            : "This certificate's hash matches the immutable record on the blockchain."}</p>
          <dl class="detail-list">
            <div><dt>Certificate No.</dt><dd>${escapeHtml(cert.certificateNumber)}</dd></div>
            <div><dt>Recipient</dt><dd>${escapeHtml(res.studentName)}</dd></div>
            <div><dt>Award</dt><dd>${escapeHtml(cert.degree)}</dd></div>
            <div><dt>Issue date</dt><dd>${fmtDate(cert.issueDate)}</dd></div>
            <div><dt>Certificate hash</dt><dd>${escapeHtml(cert.hash)}</dd></div>
            <div><dt>Blockchain tx</dt><dd>${escapeHtml(res.transaction?.txHash || "—")}</dd></div>
          </dl>
        </div>
      </div>
    </div>`;
}

function sealIcon(kind) {
  if (kind === "check") {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
}
