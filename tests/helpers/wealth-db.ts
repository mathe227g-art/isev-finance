import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
export async function wealthDb() {
  const db = new PGlite();
  await db.exec(
    `create role anon nologin;create role authenticated nologin;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const name of [
    "202609220001_phase_one.sql",
    "202609220002_financial_core.sql",
    "202609220003_budgets_insights.sql",
    "202609220004_wealth_cards.sql",
    "20260924213950_customer_value_dashboard.sql",
    "20260924215207_security_performance_followup.sql",
    "20260924215635_business_clients_accountant_audit.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  const users = [
    "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  ];
  for (const [index,id] of users.entries())
    await db.query("insert into auth.users(id,email) values($1,$2)", [id,`user${index}@example.test`]);
  const as = async (user: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    await db.exec("set role authenticated");
  };
  const one = async (sql: string, args: unknown[] = []) =>
    (await db.query<{ id: string }>(sql, args)).rows[0].id;
  await as(users[0]);
  const profile = await one(
    "insert into public.financial_profiles(owner_id,name,kind) values($1,'Perfil teste','CPF') returning id",
    [users[0]],
  );
  const other = await one(
    "insert into public.financial_profiles(owner_id,name,kind) values($1,'Empresa teste','CNPJ') returning id",
    [users[0]],
  );
  const account = await one(
    "insert into public.accounts(financial_profile_id,name,opening_balance) values($1,'Conta teste',10000) returning id",
    [profile],
  );
  const foreignAccount = await one(
    "insert into public.accounts(financial_profile_id,name) values($1,'Outra conta') returning id",
    [other],
  );
  const category = await one(
    "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Compras','expense') returning id",
    [profile],
  );
  const income = await one(
    "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Receitas','income') returning id",
    [profile],
  );
  const save = async (
    entity: string,
    data: object,
    id: string | null = null,
    p = profile,
  ) =>
    (
      await db.query<{ id: string }>(
        "select public.wealth_save($1,$2,$3,$4) id",
        [p, entity, id, data],
      )
    ).rows[0].id;
  return {
    db,
    users,
    as,
    one,
    profile,
    other,
    account,
    foreignAccount,
    category,
    income,
    save,
  };
}
