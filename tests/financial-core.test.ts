import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { authorizeFinanceWrite } from "../src/lib/profile-access.ts";
import { decimalInput, money, transactionSchema } from "../src/lib/finance.ts";
test("stale forms and insufficient roles cannot write after a profile switch", () => {
  assert.throws(
    () => authorizeFinanceWrite("owner", "profile-B", "profile-A"),
    /perfil ativo mudou/,
  );
  assert.throws(
    () => authorizeFinanceWrite("viewer", "profile-A", "profile-A"),
    /acesso/,
  );
  assert.throws(
    () => authorizeFinanceWrite("editor", "profile-A", "profile-A", true),
    /acesso/,
  );
  assert.doesNotThrow(() =>
    authorizeFinanceWrite("editor", "profile-A", "profile-A"),
  );
});
test("decimal validation and formatting avoid floating point arithmetic", () => {
  assert.equal(decimalInput("1.250,90"), "1250.90");
  assert.equal(money("9999999999999999.99"), "R$ 9.999.999.999.999.999,99");
  assert.equal(money("-0.10"), "- R$ 0,10");
  assert.throws(() => decimalInput("1,234"));
  assert.throws(() => decimalInput("Infinity"));
  assert.equal(transactionSchema.safeParse({ amount: "0" }).success, false);
});
test("Phase 2 financial integrity and tenant isolation", async (t) => {
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin;create schema auth;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
  for (const file of [
    "202609220001_phase_one.sql",
    "202609220002_financial_core.sql",
    "202609220003_budgets_insights.sql",
"202609220004_wealth_cards.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../supabase/migrations/" + file, import.meta.url),
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
  const asUser = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  const one = async (sql: string, args: unknown[] = []) => {
    const r = await db.query<{ id: string }>(sql, args);
    return r.rows[0].id;
  };
  await asUser(users[0]);
  const p = await one(
    "insert into public.financial_profiles(owner_id,name,kind) values($1,'Pessoal','CPF') returning id",
    [users[0]],
  );
  const other = await one(
    "insert into public.financial_profiles(owner_id,name,kind) values($1,'Empresa','CNPJ') returning id",
    [users[0]],
  );
  const a = await one(
    "insert into public.accounts(financial_profile_id,name,opening_balance) values($1,'Banco A',1000) returning id",
    [p],
  );
  const b = await one(
    "insert into public.accounts(financial_profile_id,name,opening_balance) values($1,'Carteira B',50) returning id",
    [p],
  );
  const foreignAccount = await one(
    "insert into public.accounts(financial_profile_id,name) values($1,'Outro perfil') returning id",
    [other],
  );
  const income = await one(
    "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Salário','income') returning id",
    [p],
  );
  const expense = await one(
    "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Moradia','expense') returning id",
    [p],
  );
  const foreignCategory = await one(
    "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Outra despesa','expense') returning id",
    [other],
  );
  const insert = async (
    type: string,
    amount: string,
    status: string,
    account = a,
    category: string | null = type === "income" ? income : expense,
    destination: string | null = null,
  ) =>
    one(
      "insert into public.transactions(financial_profile_id,account_id,category_id,type,description,amount,transaction_date,status,destination_account_id) values($1,$2,$3,$4,'Lançamento teste',$5,private.finance_today(),$6,$7) returning id",
      [p, account, category, type, amount, status, destination],
    );
  const inc = await insert("income", "500", "completed");
  await insert("expense", "200", "completed");
  await insert("expense", "70", "pending");
  const transfer = await insert("transfer", "100", "completed", a, null, b);
  const dashboard = async (profile = p) =>
    (
      await db.query<{
        data: {
          current_balance: string;
          projected_balance: string;
          income: string;
          expense: string;
          result: string;
          payable: string;
          history: unknown[];
        };
      }>(
        "select public.finance_dashboard($1,private.finance_today()) as data",
        [profile],
      )
    ).rows[0].data;
  await t.test(
    "completed movements and atomic transfers produce exact balances",
    async () => {
      const rows = (
        await db.query<{
          id: string;
          current_balance: string;
          projected_balance: string;
        }>(
          "select * from public.financial_account_balances where financial_profile_id=$1 order by name",
          [p],
        )
      ).rows;
      assert.equal(rows.find((x) => x.id === a)?.current_balance, "1200.00");
      assert.equal(rows.find((x) => x.id === b)?.current_balance, "150.00");
      assert.equal(rows.find((x) => x.id === a)?.projected_balance, "1130.00");
      const d = await dashboard();
      assert.equal(d.current_balance, "1350.00");
      assert.equal(d.projected_balance, "1280.00");
      assert.equal(d.income, "500.00");
      assert.equal(d.expense, "200.00");
      assert.equal(d.result, "300.00");
      assert.equal(d.payable, "70.00");
      assert.equal(d.history.length, 6);
    },
  );
  await t.test(
    "profile switching scopes every query, even for same owner",
    async () => {
      assert.equal((await dashboard(other)).income, "0");
      const result = await db.query<{
        data: { rows: unknown[]; total: number };
      }>(
        "select public.finance_transactions($1,date '1900-01-01',date '2100-12-31') as data",
        [other],
      );
      assert.equal(result.rows[0].data.total, 0);
    },
  );
  await t.test(
    "cross-profile account/category/transfer, mismatched categories and invalid amounts rejected",
    async () => {
      await assert.rejects(
        insert("expense", "5", "pending", foreignAccount),
        /foreign key/,
      );
      await assert.rejects(
        insert("expense", "5", "pending", a, foreignCategory),
        /foreign key/,
      );
      await assert.rejects(
        insert("expense", "5", "pending", a, income),
        /foreign key/,
      );
      await assert.rejects(
        insert("transfer", "5", "pending", a, null, foreignAccount),
        /foreign key/,
      );
      await assert.rejects(
        insert("transfer", "5", "pending", a, null, a),
        /check constraint/,
      );
      for (const amount of ["0", "-1", "NaN", "Infinity"])
        await assert.rejects(
          insert("income", amount, "completed"),
          /constraint|overflow/,
        );
      await assert.rejects(
        db.query(
          "update public.transactions set transaction_date=private.finance_today()+1 where id=$1",
          [inc],
        ),
        /Future transactions/,
      );
    },
  );
  await t.test(
    "pending future does not affect available money; overdue is derived",
    async () => {
      const id = await insert("expense", "12.34", "pending");
      await db.query(
        "update public.transactions set transaction_date=private.finance_today()+10,due_date=private.finance_today()-1 where id=$1",
        [id],
      );
      assert.equal((await dashboard()).current_balance, "1350.00");
      assert.equal(
        (
          await db.query<{ display_status: string }>(
            "select display_status from public.financial_transaction_feed where id=$1",
            [id],
          )
        ).rows[0].display_status,
        "overdue",
      );
      await db.query(
        "update public.transactions set status='cancelled' where id=$1",
        [id],
      );
      assert.equal((await dashboard()).projected_balance, "1280.00");
    },
  );
  await t.test(
    "account and category deletion cannot silently destroy history",
    async () => {
      await assert.rejects(
        db.query("delete from public.accounts where id=$1", [a]),
        /foreign key/,
      );
      await assert.rejects(
        db.query("delete from public.transaction_categories where id=$1", [
          expense,
        ]),
        /foreign key/,
      );
      await assert.rejects(
        db.query(
          "update public.transaction_categories set kind='income' where id=$1",
          [expense],
        ),
        /foreign key/,
      );
    },
  );
  await t.test(
    "unrelated user cannot read or mutate another users financial data",
    async () => {
      await asUser(users[1]);
      for (const table of [
        "transactions",
        "recurring_transactions",
        "financial_transaction_feed",
        "financial_account_balances",
      ])
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
      assert.equal(
        (
          await db.query(
            "delete from public.transactions where id=$1 returning id",
            [inc],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "update public.transactions set description='Ataque' where id=$1 returning id",
            [inc],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        insert("income", "5", "pending"),
        /row-level security/,
      );
      assert.equal((await dashboard()).current_balance, "0");
      await assert.rejects(
        db.query(
          "select public.materialize_recurring($1,private.finance_today(),private.finance_today()+30)",
          [p],
        ),
        /Access denied/,
      );
    },
  );
  await db.exec("reset role");
  await db.query(
    "insert into public.financial_profile_members(financial_profile_id,user_id,role) values($1,$2,'viewer'),($1,$3,'editor')",
    [p, users[2], users[3]],
  );
  await t.test(
    "viewer reads but cannot write; editor writes but cannot delete",
    async () => {
      await asUser(users[2]);
      assert.equal((await dashboard()).income, "500.00");
      await assert.rejects(
        insert("expense", "5", "pending"),
        /row-level security/,
      );
      assert.equal(
        (
          await db.query(
            "update public.transactions set description='Viewer edit' where id=$1 returning id",
            [inc],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query(
          "select public.materialize_recurring($1,private.finance_today(),private.finance_today()+30)",
          [p],
        ),
        /Access denied/,
      );
      await asUser(users[3]);
      const id = await insert("expense", "5", "pending");
      assert.equal(
        (
          await db.query(
            "update public.transactions set description='Editor edit' where id=$1 returning id",
            [id],
          )
        ).rows.length,
        1,
      );
      assert.equal(
        (
          await db.query(
            "delete from public.transactions where id=$1 returning id",
            [id],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "delete from public.accounts where id=$1 returning id",
            [b],
          )
        ).rows.length,
        0,
      );
    },
  );
  await asUser(users[0]);
  await t.test(
    "recurrences clamp month end, are bounded, idempotent and preserve cancelled occurrences",
    async () => {
      const r = await one(
        "insert into public.recurring_transactions(financial_profile_id,account_id,category_id,type,description,amount,frequency,due_day,start_date) values($1,$2,$3,'expense','Aluguel teste',100,'monthly',31,(date_trunc('month',private.finance_today())-interval '2 months')::date) returning id",
        [p, a, expense],
      );
      const sql =
        "select public.materialize_recurring($1,(date_trunc('month',private.finance_today())-interval '2 months')::date,(date_trunc('month',private.finance_today())+interval '1 month'-interval '1 day')::date) as added";
      assert.equal(
        (await db.query<{ added: number }>(sql, [p])).rows[0].added,
        3,
      );
      assert.equal(
        (await db.query<{ added: number }>(sql, [p])).rows[0].added,
        0,
      );
      const generated = (
        await db.query<{ id: string; valid: boolean }>(
          "select id,transaction_date=(date_trunc('month',transaction_date)+interval '1 month'-interval '1 day')::date as valid from public.transactions where recurring_transaction_id=$1",
          [r],
        )
      ).rows;
      assert.ok(generated.every((x) => x.valid));
      await assert.rejects(
        db.query("delete from public.transactions where id=$1", [
          generated[0].id,
        ]),
        /Cancel recurring occurrences/,
      );
      await db.query(
        "update public.transactions set status='cancelled' where id=$1",
        [generated[0].id],
      );
      assert.equal(
        (await db.query<{ added: number }>(sql, [p])).rows[0].added,
        0,
      );
      await assert.rejects(
        db.query(
          "select public.materialize_recurring($1,private.finance_today(),private.finance_today()+367)",
          [p],
        ),
        /Choose a range/,
      );
      await db.query(
        "update public.recurring_transactions set active=false where id=$1",
        [r],
      );
      assert.equal(
        (
          await db.query<{ n: number }>(
            "select count(*)::integer as n from public.transactions where recurring_transaction_id=$1 and status='pending' and coalesce(due_date,transaction_date)>=private.finance_today()",
            [r],
          )
        ).rows[0].n,
        0,
      );
      await assert.rejects(
        db.query(
          "update public.recurring_transactions set active=true where id=$1",
          [r],
        ),
        /Create a new recurrence/,
      );
    },
  );
  await t.test(
    "all frequencies respect start/end dates and generation is idempotent",
    async () => {
      for (const [frequency, expected] of [
        ["weekly", 53],
        ["monthly", 12],
        ["bimonthly", 6],
        ["quarterly", 4],
        ["semiannual", 2],
        ["annual", 1],
      ] as const) {
        const rule = await one(
          "insert into public.recurring_transactions(financial_profile_id,account_id,category_id,type,description,amount,frequency,due_day,start_date,end_date) values($1,$2,$3,'expense',$4,10,$4,31,'2024-01-01','2024-12-31') returning id",
          [p, a, expense, frequency],
        );
        await db.query(
          "select public.materialize_recurring($1,'2024-01-01','2024-12-31')",
          [p],
        );
        await db.query(
          "select public.materialize_recurring($1,'2024-01-01','2024-12-31')",
          [p],
        );
        const result = (
          await db.query<{ n: number; valid: boolean }>(
            "select count(*)::integer n,bool_and(transaction_date between date '2024-01-01' and date '2024-12-31' and status='pending') valid from public.transactions where recurring_transaction_id=$1",
            [rule],
          )
        ).rows[0];
        assert.equal(result.n, expected, frequency);
        assert.equal(result.valid, true);
        await db.query(
          "update public.transactions set status='cancelled' where recurring_transaction_id=$1",
          [rule],
        );
        await db.query(
          "update public.recurring_transactions set active=false where id=$1",
          [rule],
        );
      }
    },
  );
  await t.test(
    "combined filters and pagination retain exact totals",
    async () => {
      const query =
        "select public.finance_transactions($1,'1900-01-01','2100-12-31','income',$2,$3,'completed','LANÇAMENTO','variable',$4) data";
      const result = (
        await db.query<{
          data: {
            total: number;
            rows: { id: string }[];
            summary: { completed: string };
          };
        }>(query, [p, a, income, 1])
      ).rows[0].data;
      assert.equal(result.total, 1);
      assert.equal(result.rows[0].id, inc);
      assert.equal(result.summary.completed, "500.00");
      assert.equal(
        (
          await db.query<{ data: { rows: unknown[]; total: number } }>(query, [
            p,
            a,
            income,
            2,
          ])
        ).rows[0].data.rows.length,
        0,
      );
      const d = (
        await db.query<{
          data: {
            categories: { amount: string; percentage: string }[];
            upcoming: { status: string }[];
          };
        }>("select public.finance_dashboard($1,private.finance_today()) data", [
          p,
        ])
      ).rows[0].data;
      assert.equal(d.categories[0].amount, "200.00");
      assert.equal(d.categories[0].percentage, "100.00");
      assert.ok(d.upcoming.every((row) => row.status === "pending"));
    },
  );
  await t.test(
    "transfer deletion reverses both sides in one statement",
    async () => {
      await db.query("delete from public.transactions where id=$1", [transfer]);
      assert.equal(
        (
          await db.query<{ current_balance: string }>(
            "select current_balance from public.financial_account_balances where id=$1",
            [b],
          )
        ).rows[0].current_balance,
        "50.00",
      );
      assert.equal((await dashboard()).current_balance, "1350.00");
    },
  );
  await t.test(
    "anonymous cannot access new tables, views or RPCs",
    async () => {
      await db.exec("reset role;set role anon");
      for (const table of [
        "transactions",
        "recurring_transactions",
        "financial_transaction_feed",
        "financial_account_balances",
      ])
        await assert.rejects(
          db.query(`select * from public.${table}`),
          /permission denied/,
        );
      await assert.rejects(
        db.query("select public.finance_dashboard($1,current_date)", [p]),
        /permission denied/,
      );
    },
  );
  await db.close();
});
