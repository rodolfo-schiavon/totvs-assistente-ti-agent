import assert from "node:assert/strict";
import {
  generateTemporaryPassword,
  passwordStatus,
  validateStrongPassword,
} from "./password-policy.js";

function testPolicy() {
  assert.equal(validateStrongPassword("short").ok, false);
  assert.equal(validateStrongPassword("abcdefghijkl").ok, false);
  assert.ok(validateStrongPassword("Abcdefgh123!").ok);
  const temp = generateTemporaryPassword();
  assert.ok(temp.length >= 12);
  assert.ok(validateStrongPassword(temp).ok);
  const st = passwordStatus(new Date(Date.now() - 44 * 86400000), false);
  assert.equal(st.passwordExpiringSoon, true);
  console.log("password-policy.test ok");
}

testPolicy();
