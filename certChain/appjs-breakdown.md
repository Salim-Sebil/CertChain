# CertChain Front-End Breakdown

This document explains the JavaScript in `app.js` in a simplified way and includes a cheat sheet of the main functions.

## Overview

`app.js` is the front-end logic for the CertChain app. It runs as a single-page app using hash-based navigation (`#/verify`, `#/admin`, `#/student`, etc.).

It does the following:
- renders the correct screen based on the URL
- manages login and session state
- shows admin dashboards and student dashboards
- handles certificate verification
- calls backend APIs through the `Api` object in `api.js`
- updates the DOM directly without a framework

---

## 1) App state and setup

At the top of the file:

```js
const app = document.getElementById("app");
let currentUser = null;
let renderToken = 0;
```

### Purpose
- `app` is the main DOM container where all pages are injected.
- `currentUser` holds the logged-in user profile.
- `renderToken` prevents stale async page loads from replacing a newer view.

---

## 2) Toast and modal helpers

### `toast(message, isError = false)`
Displays a temporary notification message, usually for success or error feedback.

### `showModal(innerHtml)`
Creates a popup modal and appends it to the page.

### `closeModal()`
Removes the currently open modal.

These utilities are used for:
- login errors
- registration feedback
- certificate verification status
- QR code display
- transaction detail modals

---

## 3) Router and navigation

### `parseHash()`
Reads the current hash route and extracts the path and query string.

Example:
- `#/admin` → path = `admin`
- `#/verify?cert=ABC-123` → path = `verify`, query = `cert=ABC-123`

### `updateNavActive(path)`
Highlights the active link in the top navigation.

### `updateSessionSlot()`
Updates the login/logout UI in the header.
- if logged in: shows the user name and role
- if not logged in: shows a login link
- also hides or shows role-specific menu items

### `renderRoute()`
The main routing function.

It does this:
- checks access rules
- updates navigation
- redirects invalid routes
- calls the correct screen renderer

Example rules:
- only admin can access `#/admin`
- only student can access `#/student`

### Event listeners
- `hashchange` triggers route updates when the URL changes
- `DOMContentLoaded` initializes the app and seeds demo data

---

## 4) Small helper functions

### `escapeHtml(str)`
Escapes browser-sensitive characters in strings so HTML is safe to inject.

### `fmtDate(iso)`
Formats ISO date strings into readable dates.

### `statusBadge(status)`
Returns HTML for a badge such as:
- Valid
- Revoked

---

## 5) Login screen

### `renderLogin()`
Builds the sign-in page.

It includes:
- email field
- password field
- demo account buttons
- submit button

It listens for:
- demo account fill actions
- form submission

When the user submits:
- `Api.login(email, password)` is called
- `currentUser` is set
- if the user must change password, the app redirects to the password update screen
- otherwise, the user is sent to `/admin` or `/student`

### `renderSetPassword(resetToken = null)`
Shows the password-reset form.

It validates:
- password and confirm password match
- password meets minimum length

Then it calls:
- `Api.setPasswordWithResetToken()` for reset flow
- `Api.setPassword()` for normal force-change flow

---

## 6) Admin dashboard

### `renderAdmin()`
This is the main admin control panel.

It loads:
- list of certificates
- summary statistics

Then it inserts HTML for:
- stat tiles
- tabs
- issue certificate form
- register student form
- ledger table
- reports panel

It then attaches event handlers using:
- `wireTabs()`
- `wireIssueForm()`
- `wireRegisterForm()`

### `statTilesHtml(summary)`
Builds the summary metric tiles.

Typical metrics:
- total certificates
- revoked certificates
- verification checks

### `refreshAdminSummary()`
Reloads the dashboard summary after actions like issuing or revoking a certificate.

### `wireTabs()`
Switches between the visible admin tabs.

### `wireIssueForm()`
Handles issuing a new certificate.

Flow:
- reads selected student, degree, issue date
- calls `Api.issueCertificate(...)`
- shows a success toast
- refreshes the ledger and summary

### `wireRegisterForm()`
Handles student registration.

Flow:
- reads form values
- calls `Api.registerStudent(...)`
- shows a success message with temporary password info
- refreshes the issue student dropdown

### `renderLedgerTable(certificates)`
Builds the certificate ledger table.

It shows:
- certificate number
- student name
- degree
- issue date
- status
- Revoke button

It also attaches click handlers to revoke actions.

### `renderReportBars(summary)`
Creates the bar-style report chart for certificates by programme.

---

## 7) Student dashboard

### `renderStudent()`
Builds the student page.

It loads:
- current student’s certificates
- the student’s profile details

Then it renders:
- welcome header
- certificate cards
- profile form

Each certificate card includes buttons for:
- show QR code
- view blockchain transaction
- download certificate

### `openQrModal(certificateId)`
Opens a modal with the certificate’s QR code.

### `openTxModal(certificateId)`
Shows blockchain transaction data for a certificate.

### `downloadCertificate(certificateId)`
Creates a JSON file containing the certificate data and downloads it.

---

## 8) Public verification page

### `renderVerify(params)`
Builds the verifier page.

It includes:
- certificate number search box
- upload file input
- QR scan button
- verification result container

It attaches handlers for:
- verify button click
- Enter key in search input
- file upload
- scan button

### `handleFileUpload(e)`
Reads a JSON certificate file and extracts either:
- `hash`, or
- `certificateNumber`

Then runs verification.

### `openScanner()`
Starts the QR scanning flow with camera access.

### `loadScannerLib()`
Loads the external QR scanner script from a CDN if it is not already available.

### `startScanner(overlay)`
Starts scanning for QR codes and sends the decoded value to verification.

### `stopScanner()`
Stops the scanner cleanly.

### `runVerification(query)`
Calls `Api.verifyCertificate(query)` and updates the result panel.

### `renderVerifyResult(res, query)`
Builds the verification display.

It shows one of:
- Valid Certificate
- Revoked
- Not Found

### `sealIcon(kind)`
Generates the green check or red cross icon used in verification results.

---

## 9) What this file is really doing

In simple terms, [app.js](app.js) is the entire front-end controller for the project.

It:
1. decides which page to show
2. renders HTML into the app container
3. listens for clicks and form submissions
4. calls backend APIs
5. redraws the page with new data
6. handles public verification and admin/student actions

---

## Cheat sheet: main functions

| Function | Purpose |
|---|---|
| `parseHash()` | Read route path from URL hash |
| `updateNavActive()` | Highlight active navigation item |
| `updateSessionSlot()` | Show login/logout state in header |
| `renderRoute()` | Main router for all app pages |
| `toast()` | Show temporary success/error message |
| `showModal()` | Open a modal overlay |
| `closeModal()` | Close modal |
| `escapeHtml()` | Escape user text for safe HTML |
| `fmtDate()` | Format date strings |
| `statusBadge()` | Create valid/revoked badge HTML |
| `renderLogin()` | Login page layout and logic |
| `renderSetPassword()` | Password update/reset page |
| `renderAdmin()` | Admin dashboard |
| `wireTabs()` | Handle tab switching |
| `wireIssueForm()` | Issue certificate flow |
| `wireRegisterForm()` | Register student flow |
| `renderLedgerTable()` | Render certificate ledger table |
| `renderReportBars()` | Render programme summary bars |
| `renderStudent()` | Student dashboard |
| `openQrModal()` | Show QR code modal |
| `openTxModal()` | Show blockchain transaction modal |
| `downloadCertificate()` | Download certificate JSON |
| `renderVerify()` | Public verification page |
| `handleFileUpload()` | Read uploaded certificate file |
| `openScanner()` | Start camera-based QR scanning |
| `runVerification()` | Verify certificate through API |
| `renderVerifyResult()` | Show validation result |
| `sealIcon()` | Create result check mark or cross |

---

## Quick summary

If you remember only one sentence:

`app.js` is the project’s single-page app controller that routes users through login, admin actions, student actions, and public certificate verification using plain JavaScript and DOM updates.

---

## File relationship

- `index.html` loads the app shell
- `api.js` contains the backend API requests
- `app.js` renders pages and handles user interaction
- `data.js` provides mock/demo data used by the front-end

---

This file is the “brain” of the front-end experience for the CertChain app.
