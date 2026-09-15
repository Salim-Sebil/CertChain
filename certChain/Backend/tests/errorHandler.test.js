const test = require("node:test");
const assert = require("node:assert/strict");
const AppError = require("../src/utils/AppError");
const { errorHandler } = require("../src/middleware/errorHandler");

function mockRes() {
  const res = {};
  res.statusCode = null;
  res.body = null;
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

test("AppError carries statusCode and is marked operational", () => {
  const err = new AppError("Not found", 404);
  assert.equal(err.statusCode, 404);
  assert.equal(err.isOperational, true);
  assert.equal(err.message, "Not found");
});

test("errorHandler exposes operational error messages as-is", () => {
  const res = mockRes();
  errorHandler(new AppError("Invalid email or password.", 401), {}, res, () => {});
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.message, "Invalid email or password.");
  assert.equal(res.body.success, false);
});

test("errorHandler hides internal error messages behind a generic one", () => {
  const res = mockRes();
  errorHandler(new Error("connection refused at 10.0.0.5:27017"), {}, res, () => {});
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, "Something went wrong. Please try again.");
});

test("errorHandler translates a Mongo duplicate-key error into a 409", () => {
  const res = mockRes();
  const dupErr = Object.assign(new Error("duplicate"), { code: 11000, keyPattern: { certificateNumber: 1 } });
  errorHandler(dupErr, {}, res, () => {});
  assert.equal(res.statusCode, 409);
  assert.match(res.body.message, /certificateNumber/);
});

test("errorHandler translates a CastError (bad ObjectId) into a 400", () => {
  const res = mockRes();
  const castErr = Object.assign(new Error("bad id"), { name: "CastError", path: "id" });
  errorHandler(castErr, {}, res, () => {});
  assert.equal(res.statusCode, 400);
  assert.match(res.body.message, /id/);
});
