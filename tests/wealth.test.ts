import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { wealthDb } from "./helpers/wealth-db.ts";
test("Phase 4 atomic financial rules and RLS", async (t) => {
  const x = await wealthDb();
  const { db, save, profile, account, category, foreignAccount } = x;
  try {
    const cardData = {
      name: "Cartão teste",
      institution: "Banco",
      brand: "Visa",
      last_four: "1234",
      credit_limit: "5000",
      closing_day: 20,
      due_day: 10,
      payment_account_id: account,
      color: "#087DF0",
      active: true,
    };
    const card = await save("card", cardData);
    const buy = async (
      amount: string,
      date: string,
      count = 1,
      c = card,
      cat = category,
      request = randomUUID(),
    ) =>
      (
        await db.query<{ id: string }>(
          "select public.wealth_purchase($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) id",
          [
            profile,
            c,
            cat,
            "Compra teste",
            amount,
            date,
            count,
            "variable",
            "",
            request,
          ],
        )
      ).rows[0].id;
    const invoice = async (month: string) =>
      (
        await db.query<{ id: string; total: string; due_on: string }>(
          "select id,total,due_on::text from public.card_invoice_totals where card_id=$1 and month=$2",
          [card, month],
        )
      ).rows[0];
    const dashboard = async () =>
      (
        await db.query<{
          d: {
            income: string;
            expense: string;
            current_balance: string;
            payable: string;
          };
        }>("select public.finance_dashboard($1,'2024-01-01') d", [profile])
      ).rows[0].d;
    await t.test(
      "empty card and no sensitive credentials columns",
      async () => {
        const r = (
          await db.query<{ used: string; available: string }>(
            "select used,available from public.card_summaries where id=$1",
            [card],
          )
        ).rows[0];
        assert.equal(r.used, "0");
        assert.equal(r.available, "5000.00");
        await assert.rejects(
          save("card", { ...cardData, last_four: "4111111111111111" }),
          /check constraint/,
        );
      },
    );
    const purchase = await buy("100.01", "2024-01-20", 3);
    await t.test(
      "inclusive closing, cents split exactly, different months and due rollover",
      async () => {
        const rows = (
          await db.query<{ amount: string; month: string; due_on: string }>(
            "select i.amount::text,v.month::text,v.due_on::text from public.credit_card_installments i join public.credit_card_invoices v on v.id=i.invoice_id where i.purchase_id=$1 order by number",
            [purchase],
          )
        ).rows;
        assert.deepEqual(
          rows.map((r) => r.amount),
          ["33.34", "33.34", "33.33"],
        );
        assert.deepEqual(
          rows.map((r) => r.month),
          ["2024-01-01", "2024-02-01", "2024-03-01"],
        );
        assert.equal(rows[0].due_on, "2024-02-10");
        assert.equal((await dashboard()).expense, "100.01");
        assert.equal((await dashboard()).current_balance, "10000.00");
      },
    );
    await t.test(
      "purchase after closing goes to next cycle, leap day clamped",
      async () => {
        const p = await buy("10", "2024-01-21");
        const r = (
          await db.query<{ month: string }>(
            "select v.month::text from public.credit_card_installments i join public.credit_card_invoices v on v.id=i.invoice_id where purchase_id=$1",
            [p],
          )
        ).rows[0];
        assert.equal(r.month, "2024-02-01");
        assert.equal(
          (
            await db.query<{ d: string }>(
              "select private.wealth_day('2024-02-01',31)::text d",
            )
          ).rows[0].d,
          "2024-02-29",
        );
        await db.query("select public.wealth_cancel_purchase($1,$2)", [
          profile,
          p,
        ]);
      },
    );
    await t.test(
      "invoice settlement debits account once and never duplicates expense",
      async () => {
        const v = await invoice("2024-01-01");
        await db.query(
          "select public.wealth_pay_invoice($1,$2,$3,'2024-01-21')",
          [profile, v.id, account],
        );
        await db.query(
          "select public.wealth_pay_invoice($1,$2,$3,'2024-01-21')",
          [profile, v.id, account],
        );
        assert.equal((await dashboard()).current_balance, "9966.66");
        assert.equal((await dashboard()).expense, "100.01");
        const cardRow = (
          await db.query<{ used: string; available: string }>(
            "select used,available from public.card_summaries where id=$1",
            [card],
          )
        ).rows[0];
        assert.equal(cardRow.used, "66.67");
        assert.equal(cardRow.available, "4933.33");
        await assert.rejects(
          db.query("select public.wealth_cancel_purchase($1,$2)", [
            profile,
            purchase,
          ]),
          /Paid installments/,
        );
      },
    );
    await t.test(
      "limit, paid-cycle, foreign profile account/category and future writes rejected",
      async () => {
        await assert.rejects(
          buy("5000", "2024-04-01"),
          /Insufficient card limit/,
        );
        await assert.rejects(buy("1", "2024-01-01"), /Invoice already paid/);
        await assert.rejects(buy("1", "2099-01-01"), /Invalid purchase/);
        await assert.rejects(
          buy("1", "2024-05-01", 1, card, x.income),
          /foreign key/,
        );
        await assert.rejects(
          save("card", { ...cardData, payment_account_id: foreignAccount }),
          /foreign key/,
        );
        await assert.rejects(
          save("card", { ...cardData, closing_day: 19 }, card),
          /Cycle with history/,
        );
        await assert.rejects(
          save("card", { ...cardData, credit_limit: "1" }, card),
          /Limit below/,
        );
      },
    );
    const positionData = {
      kind: "goal",
      name: "Viagem",
      description: "",
      institution: "",
      ticker: "",
      investment_type: "",
      target_amount: "1000",
      target_date: "2027-01-01",
      essential_cost: "",
      target_months: "",
      status: "active",
    };
    const goal = await save("position", positionData);
    const move = async (
      id: string,
      kind: string,
      amount: string,
      a: string | null = account,
      date = "2024-04-01",
      request = randomUUID(),
    ) =>
      db.query("select public.wealth_move($1,$2,$3,$4,$5,$6,$7,$8)", [
        profile,
        id,
        kind,
        amount,
        a,
        date,
        "",
        request,
      ]);
    const balance = async (id: string) =>
      (
        await db.query<{
          current_value: string;
          result: string;
          progress: string;
          months_covered: string;
          return_percentage: string;
        }>("select * from public.position_balances where id=$1", [id])
      ).rows[0];
    await t.test(
      "goal movements preserve net worth and history; withdrawal limited; completion validated",
      async () => {
        await move(goal, "deposit", "500");
        assert.equal((await balance(goal)).progress, "50.00");
        await move(goal, "withdrawal", "100");
        assert.equal((await balance(goal)).current_value, "400.00");
        await assert.rejects(
          move(goal, "withdrawal", "401"),
          /Insufficient position/,
        );
        await assert.rejects(
          save("position", { ...positionData, status: "completed" }, goal),
          /target not reached/,
        );
        await move(goal, "deposit", "600");
        await save("position", { ...positionData, status: "completed" }, goal);
        await assert.rejects(
          save("position", { ...positionData, status: "archived" }, goal),
          /Withdraw balance/,
        );
      },
    );
    await t.test(
      "emergency reserve target and months covered are derived, independent of investments",
      async () => {
        const reserve = await save("position", {
          ...positionData,
          kind: "reserve",
          name: "Reserva",
          target_amount: "",
          essential_cost: "1000",
          target_months: "6",
        });
        await move(reserve, "deposit", "2000");
        assert.equal((await balance(reserve)).months_covered, "2.00");
        assert.equal((await balance(reserve)).progress, "33.33");
        await move(reserve, "withdrawal", "1000");
        assert.equal((await balance(reserve)).months_covered, "1.00");
      },
    );
    const investment = await save("position", {
      ...positionData,
      kind: "investment",
      name: "CDB",
      target_amount: "",
      investment_type: "cdb",
    });
    await t.test(
      "investment deposits, valuation, dividends and withdrawals do not become consumption",
      async () => {
        await move(investment, "deposit", "1000");
        await move(investment, "yield", "50", null);
        await move(investment, "dividend", "10", null);
        await move(investment, "valuation", "1100", null);
        await move(investment, "withdrawal", "200");
        const r = await balance(investment);
        assert.equal(r.current_value, "900.00");
        assert.equal(r.result, "100.00");
        assert.equal(r.return_percentage, "10.00");
        assert.equal((await dashboard()).expense, "100.01");
        await assert.rejects(
          move(investment, "deposit", "1", foreignAccount),
          /foreign key/,
        );
        await assert.rejects(
          move(investment, "yield", "1", account),
          /Invalid account/,
        );
        await assert.rejects(
          move(investment, "withdrawal", "1", account, "2024-03-01"),
          /follow history/,
        );
      },
    );
    await t.test(
      "assets minus liabilities includes outstanding installments, no duplicate transfers",
      async () => {
        await save("item", {
          name: "Veículo",
          kind: "asset",
          category: "vehicle",
          amount: "10000",
          notes: "",
          active: true,
        });
        await save("item", {
          name: "Empréstimo",
          kind: "liability",
          category: "loan",
          amount: "2000",
          notes: "",
          active: true,
        });
        const total = (
          await db.query<{ net_worth: string }>(
            "select net_worth from public.net_worth_totals where financial_profile_id=$1",
            [profile],
          )
        ).rows[0];
        assert.equal(total.net_worth, "17999.99");
        await db.query("select public.wealth_snapshot($1)", [profile]);
        await db.query("select public.wealth_snapshot($1)", [profile]);
        assert.equal(
          (await db.query("select * from public.net_worth_snapshots")).rows
            .length,
          1,
        );
      },
    );
    await t.test(
      "idempotency protects purchase and position movement retries",
      async () => {
        const req = randomUUID();
        const a = await buy("20", "2024-06-01", 2, card, category, req);
        assert.equal(await buy("20", "2024-06-01", 2, card, category, req), a);
        await db.query("select public.wealth_cancel_purchase($1,$2)", [
          profile,
          a,
        ]);
        const r = randomUUID();
        await move(goal, "deposit", "1", account, "2024-04-01", r);
        await move(goal, "deposit", "1", account, "2024-04-01", r);
        assert.equal((await balance(goal)).current_value, "1001.00");
      },
    );
    await t.test(
      "read RPCs deliver exact amounts, invoice detail, empty cycle and real history",
      async () => {
        const overview = (
          await db.query<{
            d: import("../src/types/wealth.ts").WealthOverview;
          }>("select public.wealth_overview($1) d", [profile])
        ).rows[0].d;
        assert.equal(overview.cards[0].credit_limit, "5000.00");
        assert.equal(overview.positions.length, 3);
        assert.equal(overview.investment.current_value, "900.00");
        assert.equal(overview.investment_history.length, 1);
        assert.equal(overview.investment_history[0].value, "900.00");
        assert.equal(overview.allocation[0].value, "900.00");
        assert.equal(typeof overview.items[0].amount, "string");
        assert.equal(overview.snapshots.length, 1);
        const detail = (
          await db.query<{ d: import("../src/types/wealth.ts").CardDetail }>(
            "select public.wealth_card_detail($1,$2,'2024-02-01') d",
            [profile, card],
          )
        ).rows[0].d;
        assert.equal(detail.invoice.total, "33.34");
        assert.equal(detail.installments[0].number, 2);
        assert.equal(detail.installments[0].count, 3);
        const empty = (
          await db.query<{ d: import("../src/types/wealth.ts").CardDetail }>(
            "select public.wealth_card_detail($1,$2,'2025-01-01') d",
            [profile, card],
          )
        ).rows[0].d;
        assert.equal(empty.invoice.id, null);
        assert.equal(empty.invoice.total, "0");
        assert.equal(empty.invoice.due_on, "2025-02-10");
        const history = (
          await db.query<{
            d: import("../src/types/wealth.ts").PositionHistory;
          }>("select public.wealth_history($1,$2,1) d", [profile, investment])
        ).rows[0].d;
        assert.equal(history.total, 5);
        assert.equal(history.rows.filter((r) => r.account_name).length, 2);
        assert.ok(history.rows.every((r) => typeof r.delta === "string"));
      },
    );
    await t.test(
      "card purchases feed budget and category reports once; invoices feed payables",
      async () => {
        const insights = (
          await db.query<{
            d: {
              expense: string;
              budget: { actual: string };
              categories: { amount: string }[];
            };
          }>("select public.finance_insights($1,'2024-01-01','month') d", [
            profile,
          ])
        ).rows[0].d;
        assert.equal(insights.expense, "100.01");
        assert.equal(insights.budget.actual, "100.01");
        assert.equal(insights.categories[0].amount, "100.01");
        const d = (
          await db.query<{ d: { expense: string; payable: string } }>(
            "select public.finance_dashboard($1,'2024-03-01') d",
            [profile],
          )
        ).rows[0].d;
        assert.equal(d.expense, "0");
        assert.equal(d.payable, "33.34");
        const v = await invoice("2024-02-01");
        await assert.rejects(
          db.query("select public.wealth_pay_invoice($1,$2,$3,'2024-02-21')", [
            profile,
            v.id,
            foreignAccount,
          ]),
          /foreign key/,
        );
        assert.equal((await invoice("2024-02-01")).total, "33.34");
      },
    );
    await t.test(
      "end of month cycles handle February and year rollover without shifting dates",
      async () => {
        const c = await save("card", {
          ...cardData,
          name: "Ciclo 31",
          closing_day: 31,
          due_day: 31,
        });
        const p = await buy("0.03", "2023-12-31", 3, c);
        const dates = (
          await db.query<{ month: string; due: string; closes: string }>(
            "select v.month::text,v.due_on::text due,v.closes_on::text closes from public.credit_card_installments i join public.credit_card_invoices v on v.id=i.invoice_id where i.purchase_id=$1 order by number",
            [p],
          )
        ).rows;
        assert.deepEqual(
          dates.map((d) => d.due),
          ["2024-01-31", "2024-02-29", "2024-03-31"],
        );
        assert.equal(dates[2].closes, "2024-02-29");
        await db.query("select public.wealth_cancel_purchase($1,$2)", [
          profile,
          p,
        ]);
        const summary = (
          await db.query<{ used: string }>(
            "select used from public.card_summaries where id=$1",
            [c],
          )
        ).rows[0];
        assert.equal(Number(summary.used), 0);
      },
    );
    await t.test(
      "direct writes denied, user/profile isolation, viewer and editor roles enforced",
      async () => {
        await assert.rejects(
          db.query(
            "update public.credit_cards set credit_limit=1 where id=$1",
            [card],
          ),
          /permission denied/,
        );
        await db.exec("reset role");
        await db.query(
          "insert into public.financial_profile_members(financial_profile_id,user_id,role) values($1,$2,'viewer'),($1,$3,'editor')",
          [profile, x.users[2], x.users[3]],
        );
        for (const table of [
          "credit_cards",
          "credit_card_invoices",
          "credit_card_purchases",
          "credit_card_installments",
          "financial_positions",
          "position_movements",
          "cash_settlements",
          "net_worth_items",
          "net_worth_snapshots",
        ]) {
          await x.as(x.users[0]);
          await assert.rejects(
            db.exec("delete from public." + table),
            /permission denied/,
          );
          await x.as(x.users[1]);
          assert.equal(
            (await db.query("select * from public." + table)).rows.length,
            0,
          );
        }
        await x.as(x.users[1]);
        assert.equal(
          (await db.query("select * from public.credit_cards")).rows.length,
          0,
        );
        await assert.rejects(
          db.query("select public.wealth_overview($1)", [profile]),
          /Access denied/,
        );
        await assert.rejects(save("card", cardData), /Access denied/);
        await x.as(x.users[2]);
        assert.equal(
          (await db.query("select * from public.credit_cards")).rows.length,
          2,
        );
        await assert.rejects(move(goal, "deposit", "1"), /Access denied/);
        await x.as(x.users[3]);
        await move(goal, "deposit", "1");
        await assert.rejects(
          db.query("select public.wealth_cancel_purchase($1,$2)", [
            profile,
            purchase,
          ]),
          /Access denied/,
        );
        await assert.rejects(
          save("card", { ...cardData, active: false }, card),
          /Access denied/,
        );
        await x.as(x.users[0]);
        await assert.rejects(
          db.query("select public.wealth_move($1,$2,$3,$4,$5,$6,$7,$8)", [
            x.other,
            goal,
            "deposit",
            1,
            account,
            "2024-04-01",
            "",
            randomUUID(),
          ]),
          /Position not available/,
        );
        await db.exec("reset role;set role anon");
        await assert.rejects(
          db.query("select public.wealth_overview($1)", [profile]),
          /permission denied/,
        );
      },
    );
  } finally {
    await db.close();
  }
});
