import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Insights } from "../src/types/insights";
import {
  financialAlerts,
  budgetSchema,
  validWindow,
} from "../src/lib/insights.ts";

test("budget input validates month, positive exact money and window", () => {
  const row = {
    category_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    month: "2026-09-01",
    amount: "1.250,90",
  };
  assert.equal(budgetSchema.parse(row).amount, "1250.90");
  assert.equal(
    budgetSchema.safeParse({ ...row, month: "2026-09-02" }).success,
    false,
  );
  assert.equal(budgetSchema.safeParse({ ...row, amount: "0" }).success, false);
  assert.equal(validWindow("bad"), "month");
});
test("Phase 3 PostgreSQL budgets, insights, permissions and regression", async (t) => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon nologin;create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
    for (const name of [
      "202609220001_phase_one.sql",
      "202609220002_financial_core.sql",
      "202609220003_budgets_insights.sql",
"202609220004_wealth_cards.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    const users = [
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
    ];
    for (const id of users)
      await db.query("insert into auth.users(id) values($1)", [id]);
    const as = async (id: string) => {
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        id,
      ]);
      await db.exec("set role authenticated");
    };
    const id = async (sql: string, args: unknown[] = []) =>
      (await db.query<{ id: string }>(sql, args)).rows[0].id;
    await as(users[0]);
    const profile = await id(
      "insert into public.financial_profiles(owner_id,name,kind) values($1,'Pessoal','CPF') returning id",
      [users[0]],
    );
    const other = await id(
      "insert into public.financial_profiles(owner_id,name,kind) values($1,'Empresa','CNPJ') returning id",
      [users[0]],
    );
    const a = await id(
      "insert into public.accounts(financial_profile_id,name,opening_balance) values($1,'Conta A',1000) returning id",
      [profile],
    );
    const b = await id(
      "insert into public.accounts(financial_profile_id,name) values($1,'Conta B') returning id",
      [profile],
    );
    const cat = async (p: string, name: string, kind = "expense") =>
      id(
        "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,$2,$3) returning id",
        [p, name, kind],
      );
    const food = await cat(profile, "Alimentação"),
      home = await cat(profile, "Moradia"),
      extra = await cat(profile, "Outros"),
      salary = await cat(profile, "Salário", "income"),
      foreign = await cat(other, "Outra");
    const budget = async (
      category: string,
      amount: string,
      month = "2024-02-01",
    ) =>
      id(
        "insert into public.monthly_budgets(financial_profile_id,category_id,month,amount) values($1,$2,$3,$4) returning id",
        [profile, category, month, amount],
      );
    const foodBudget = await budget(food, "100");
    await budget(home, "200");
    const tx = async (
      type: string,
      amount: string,
      status: string,
      category: string | null,
      kind = "variable",
      date = "2024-02-10",
      destination: string | null = null,
    ) =>
      id(
        "insert into public.transactions(financial_profile_id,account_id,category_id,type,description,amount,transaction_date,due_date,status,expense_kind,destination_account_id) values($1,$2,$3,$4,'Teste Fase 3',$5,$6,$6,$7,$8,$9) returning id",
        [profile, a, category, type, amount, date, status, kind, destination],
      );
    await tx("income", "500", "completed", salary);
    await tx("expense", "120", "completed", food);
    await tx("expense", "160", "completed", home, "fixed");
    await tx("expense", "20", "completed", extra);
    await tx("expense", "40", "pending", food);
    await tx("income", "80", "pending", salary);
    await tx("expense", "999", "cancelled", food);
    const transfer = await tx(
      "transfer",
      "50",
      "completed",
      null,
      "variable",
      "2024-02-10",
      b,
    );
    const insights = async (
      p = profile,
      month = "2024-02-01",
      window = "month",
    ) =>
      (
        await db.query<{ data: Insights }>(
          "select public.finance_insights($1,$2,$3) data",
          [p, month, window],
        )
      ).rows[0].data;
    await t.test(
      "realized excludes pending, cancelled and transfers; exact forecast and percentages",
      async () => {
        const d = await insights();
        assert.equal(d.income, "500.00");
        assert.equal(d.expense, "300.00");
        assert.equal(d.result, "200.00");
        assert.equal(d.current_balance, "1200.00");
        assert.equal(d.month_forecast, "1240.00");
        assert.equal(d.budget.planned, "300.00");
        assert.equal(d.budget.actual, "300.00");
        assert.equal(d.budget.remaining, "0.00");
        assert.equal(d.budget.percentage, "100.00");
        assert.equal(
          d.budget.categories.find((c) => c.category_id === food)?.state,
          "exceeded",
        );
        assert.equal(
          d.budget.categories.find((c) => c.category_id === home)?.state,
          "near",
        );
        assert.equal(
          d.budget.categories.find((c) => c.category_id === extra)?.state,
          "unplanned",
        );
        assert.equal(d.kinds.find((k) => k.kind === "fixed")?.amount, "160.00");
        assert.equal(d.kinds.find((k) => k.kind === "fixed")?.count, 1);
        assert.equal(
          d.kinds.find((k) => k.kind === "variable")?.percentage,
          "46.67",
        );
        assert.equal(d.daily.length, 29);
        assert.equal(d.daily.at(-1)?.income, "500.00");
        assert.equal(d.daily.at(-1)?.expense, "300.00");
        assert.equal(d.movement[9].expense, "300.00");
        assert.ok(
          financialAlerts(d).some(
            (a) => a.level === "crítico" && a.text.includes("20,00"),
          ),
        );
      },
    );
    await t.test(
      "budget CRUD, duplicate, expense-only and cross-profile constraints",
      async () => {
        await assert.rejects(budget(food, "20"), /unique/);
        await assert.rejects(budget(salary, "20"), /foreign key/);
        await assert.rejects(budget(foreign, "20"), /foreign key/);
        await assert.rejects(budget(extra, "NaN"), /check constraint/);
        await assert.rejects(budget(extra, "0"), /check constraint/);
        await assert.rejects(
          budget(extra, "1", "2024-02-02"),
          /check constraint/,
        );
        await db.query(
          "update public.monthly_budgets set amount=120 where id=$1",
          [foodBudget],
        );
        assert.equal(
          (await insights()).budget.categories.find((c) => c.id === foodBudget)
            ?.state,
          "reached",
        );
        await db.query(
          "update public.monthly_budgets set amount=100 where id=$1",
          [foodBudget],
        );
        await assert.rejects(
          db.query(
            "update public.monthly_budgets set financial_profile_id=$1 where id=$2",
            [other, foodBudget],
          ),
          /permission denied/,
        );
        const temp = await budget(extra, "10");
        await db.query("delete from public.monthly_budgets where id=$1", [
          temp,
        ]);
        assert.equal((await insights()).expense, "300.00");
      },
    );
    await t.test(
      "empty month, budget without transactions and transactions without budgets",
      async () => {
        const empty = await insights(profile, "2024-03-01");
        assert.equal(empty.budget.configured, 0);
        assert.equal(empty.budget.percentage, null);
        assert.equal(empty.expense, "0");
        assert.ok(
          empty.daily.every((d) => d.income === "0" && d.expense === "0"),
        );
        await budget(food, "77", "2024-03-01");
        const planned = await insights(profile, "2024-03-01");
        assert.equal(planned.budget.remaining, "77.00");
        assert.equal(planned.budget.percentage, "0.00");
        await tx(
          "expense",
          "12.34",
          "completed",
          extra,
          "variable",
          "2024-01-04",
        );
        const unplanned = await insights(profile, "2024-01-01");
        assert.equal(unplanned.budget.actual, "12.34");
        assert.equal(unplanned.budget.percentage, null);
        assert.equal(unplanned.budget.categories[0].state, "unplanned");
      },
    );
    await t.test(
      "windows use selected month, leap day and year boundaries",
      async () => {
        for (const [window, count] of [
          ["7d", 7],
          ["month", 29],
          ["3m", 3],
          ["6m", 6],
          ["year", 12],
        ] as const) {
          const d = await insights(profile, "2024-02-01", window);
          assert.equal(d.movement.length, count);
        }
        const d = await insights(profile, "2024-02-01", "3m");
        assert.equal(d.chart_from, "2023-12-01");
        assert.equal(d.chart_to, "2024-02-29");
        await assert.rejects(
          insights(profile, "2024-02-01", "bad"),
          /Invalid period/,
        );
      },
    );
    await t.test(
      "profile and user isolation, viewer read-only, editor writes and owner delete",
      async () => {
        assert.equal((await insights(other)).budget.configured, 0);
        assert.equal((await insights(other)).income, "0");
        await db.exec("reset role");
        await db.query(
          "insert into public.financial_profile_members(financial_profile_id,user_id,role) values($1,$2,'viewer'),($1,$3,'editor')",
          [profile, users[2], users[3]],
        );
        await as(users[1]);
        assert.equal(
          (await db.query("select * from public.monthly_budgets")).rows.length,
          0,
        );
        await assert.rejects(insights(), /Access denied/);
        await assert.rejects(budget(extra, "100"), /row-level security/);
        await as(users[2]);
        assert.equal((await insights()).budget.configured, 2);
        await assert.rejects(budget(extra, "100"), /row-level security/);
        assert.equal(
          (
            await db.query(
              "update public.monthly_budgets set amount=1 where id=$1 returning id",
              [foodBudget],
            )
          ).rows.length,
          0,
        );
        await as(users[3]);
        const edited = await budget(extra, "100");
        await db.query(
          "update public.monthly_budgets set amount=90 where id=$1",
          [edited],
        );
        assert.equal(
          (
            await db.query(
              "delete from public.monthly_budgets where id=$1 returning id",
              [edited],
            )
          ).rows.length,
          0,
        );
        await as(users[0]);
        await db.query("delete from public.monthly_budgets where id=$1", [
          edited,
        ]);
      },
    );
    await t.test(
      "recurrence can be variable; classification copies only to new occurrences",
      async () => {
        const rule = await id(
          "insert into public.recurring_transactions(financial_profile_id,account_id,category_id,type,description,amount,frequency,due_day,start_date,end_date,expense_kind) values($1,$2,$3,'expense','Energia variável',10,'monthly',1,'2024-04-01','2024-05-01','variable') returning id",
          [profile, a, extra],
        );
        await db.query(
          "select public.materialize_recurring($1,'2024-04-01','2024-04-30')",
          [profile],
        );
        await db.query(
          "update public.recurring_transactions set expense_kind='fixed' where id=$1",
          [rule],
        );
        await db.query(
          "select public.materialize_recurring($1,'2024-04-01','2024-05-31')",
          [profile],
        );
        const rows = (
          await db.query<{ expense_kind: string }>(
            "select expense_kind from public.financial_transaction_feed where recurring_transaction_id=$1 order by transaction_date",
            [rule],
          )
        ).rows;
        assert.deepEqual(
          rows.map((r) => r.expense_kind),
          ["variable", "fixed"],
        );
        await db.query(
          "update public.transactions set status='completed' where recurring_transaction_id=$1",
          [rule],
        );
        assert.equal(
          (await insights(profile, "2024-04-01")).kinds.find(
            (k) => k.kind === "variable",
          )?.amount,
          "10.00",
        );
        await db.query(
          "update public.transactions set status='cancelled' where recurring_transaction_id=$1",
          [rule],
        );
      },
    );
    await t.test(
      "due lists and 7-day alerts use due dates, omit cancelled, and retain overdue independently",
      async () => {
        const now = (
          await db.query<{ date: string }>(
            "select private.finance_today()::text date",
          )
        ).rows[0].date;
        await tx("expense", "25", "pending", food, "variable", now);
        await tx("expense", "900", "cancelled", food, "variable", now);
        const d = await insights();
        assert.equal(d.due_week, "25.00");
        assert.equal(d.next_pay.length, 1);
        assert.ok(
          financialAlerts(d).some(
            (a) => a.level === "informação" && a.text.includes("25,00"),
          ),
        );
        const due = (
          await db.query<{ data: { total: number } }>(
            "select public.finance_due($1,'expense',$2,'2100-12-31') data",
            [profile, now],
          )
        ).rows[0].data;
        assert.equal(due.total, 1);
      },
    );
    await t.test(
      "existing transaction edits, cancellation, deletion and transfer logic survive upgrade",
      async () => {
        const before = (await insights()).current_balance;
        await db.query("update public.transactions set amount=75 where id=$1", [
          transfer,
        ]);
        assert.equal((await insights()).current_balance, before);
        await db.query(
          "update public.transactions set status='cancelled' where id=$1",
          [transfer],
        );
        assert.equal((await insights()).current_balance, before);
        await db.query("delete from public.transactions where id=$1", [
          transfer,
        ]);
        assert.equal((await insights()).current_balance, before);
      },
    );
    await t.test(
      "anonymous cannot access budget table or insights RPC",
      async () => {
        await db.exec("reset role;set role anon");
        await assert.rejects(
          db.query("select * from public.monthly_budgets"),
          /permission denied/,
        );
        await assert.rejects(insights(), /permission denied/);
      },
    );
  } finally {
    await db.close();
  }
});
