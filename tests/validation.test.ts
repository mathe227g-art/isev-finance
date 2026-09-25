import { test } from "node:test";
import assert from "node:assert/strict";
import {
  passwordSchema,
  signupSchema,
  profileSchema,
  uuidSchema,
} from "../src/lib/validation.ts";
test("password strength and matching confirmation enforced", () => {
  for (const value of [
    "short",
    "alllowercase12",
    "ALLUPPERCASE12",
    "NoNumbersHere",
    "Abc12345",
    "Abc1234 ",
    "Abc12!",
  ])
    assert.equal(passwordSchema.safeParse(value).success, false);
  assert.equal(passwordSchema.safeParse("Abcd123!").success, true);
  assert.equal(passwordSchema.safeParse("UmaSenhaSegura123!").success, true);
  assert.equal(
    signupSchema.safeParse({
      name: "Maria",
      email: "maria@example.com",
      password: "UmaSenhaSegura123!",
      confirm: "OutraSenha123",
    }).success,
    false,
  );
});
test("financial profiles reject unknown kind, blank names and invalid IDs", () => {
  assert.equal(
    profileSchema.safeParse({ name: "  ", kind: "CPF" }).success,
    false,
  );
  assert.equal(
    profileSchema.safeParse({ name: "Pessoal", kind: "admin" }).success,
    false,
  );
  assert.deepEqual(profileSchema.parse({ name: " Pessoal ", kind: "CPF" }), {
    name: "Pessoal",
    kind: "CPF",
  });
  assert.equal(uuidSchema.safeParse("../other-user").success, false);
});
