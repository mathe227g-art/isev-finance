import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  cardSchema,
  purchaseSchema,
  movementSchema,
  currentBillingMonth,
  cardTextColor,
} from "../src/lib/wealth.ts";
test("Phase 4 input rejects sensitive card numbers and invalid movements, preserves cents and civil dates", () => {
  const card = {
    name: "Cartão",
    institution: "",
    brand: "",
    last_four: "1234",
    credit_limit: "5.000,01",
    closing_day: "31",
    due_day: "10",
    payment_account_id: randomUUID(),
    color: "#ffffff",
    active: "true",
  };
  assert.equal(cardSchema.parse(card).credit_limit, "5000.01");
  assert.equal(
    cardSchema.safeParse({ ...card, last_four: "4111111111111111" }).success,
    false,
  );
  const purchase = {
    card_id: randomUUID(),
    category_id: randomUUID(),
    description: "Compra",
    amount: "100,01",
    purchase_date: "2024-02-29",
    installment_count: "3",
    expense_kind: "variable",
    notes: "",
    request_id: randomUUID(),
  };
  assert.equal(purchaseSchema.parse(purchase).amount, "100.01");
  assert.equal(
    purchaseSchema.safeParse({ ...purchase, installment_count: 61 }).success,
    false,
  );
  assert.equal(
    purchaseSchema.safeParse({ ...purchase, purchase_date: "2023-02-29" })
      .success,
    false,
  );
  const m = {
    position_id: randomUUID(),
    kind: "valuation",
    amount: "0",
    account_id: "",
    movement_date: "2024-03-01",
    notes: "",
    request_id: randomUUID(),
  };
  assert.equal(movementSchema.parse(m).amount, "0.00");
  assert.equal(
    movementSchema.safeParse({ ...m, kind: "deposit" }).success,
    false,
  );
  assert.equal(
    movementSchema.safeParse({ ...m, account_id: randomUUID() }).success,
    false,
  );
  assert.equal(
    movementSchema.safeParse({
      ...m,
      kind: "withdrawal",
      account_id: randomUUID(),
    }).success,
    false,
  );
  assert.equal(currentBillingMonth(20, "2024-12-20"), "2024-12");
  assert.equal(currentBillingMonth(20, "2024-12-21"), "2025-01");
  assert.equal(currentBillingMonth(31, "2024-02-29"), "2024-02");
  assert.equal(cardTextColor("#ffffff"), "#061d35");
  assert.equal(cardTextColor("#000000"), "#ffffff");
});
