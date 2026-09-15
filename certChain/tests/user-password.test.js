require("dotenv").config();

const test = require("node:test");
const assert = require("node:assert/strict");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

test("user can set a new password without storing plain text", async () => {
  await connectDB();

  const email = `test.student.${Date.now()}@example.com`;
  const user = new User({
    name: "Test Student",
    email,
    password: "old-password",
    role: "student",
  });

  await user.setPassword("NewSecurePass!123");

  assert.notEqual(user.password, "NewSecurePass!123");
  assert.equal(await user.comparePassword("NewSecurePass!123"), true);
  assert.equal(await user.comparePassword("old-password"), false);
});
