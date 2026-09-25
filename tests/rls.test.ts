import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

// Real PostgreSQL execution via WASM, with ONLY Supabase's auth boundary stubbed.
// No production connection or user data is used by this suite.
test("Phase 1 migration, integrity and RLS", async (t) => {
  const db = new PGlite();
  const alice = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const bob = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const viewer = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  await db.exec(`create role anon nologin; create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;`);
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609220001_phase_one.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    `insert into auth.users(id,raw_user_meta_data) values('${alice}','{"full_name":"Alice Teste"}'),('${bob}','{"full_name":"Bob Teste"}'),('${viewer}','{"full_name":"Viewer Teste"}');`,
  );
  const asUser = async (id: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec("set role authenticated");
  };
  await asUser(alice);
  const result = await db.query<{ id: string }>(
    "insert into public.financial_profiles(owner_id,name,kind) values($1,'Alice pessoal','CPF') returning id",
    [alice],
  );
  const profile = result.rows[0].id;
  await db.query(
    "insert into public.accounts(financial_profile_id,name,opening_balance) values($1,'Conta Alice','0.10')",
    [profile],
  );
  await db.query(
    "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Alimentação','expense')",
    [profile],
  );
  await t.test("new user and owner membership created atomically", async () => {
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      1,
    );
    assert.equal(
      (
        await db.query<{ role: string }>(
          "select role from public.financial_profile_members",
        )
      ).rows[0].role,
      "owner",
    );
  });
  await t.test("anonymous access denied on every table", async () => {
    await db.exec("reset role; set role anon");
    for (const table of [
      "profiles",
      "financial_profiles",
      "financial_profile_members",
      "accounts",
      "transaction_categories",
    ])
      await assert.rejects(
        db.query(`select * from public.${table}`),
        /permission denied/,
      );
  });
  await asUser(bob);
  await t.test(
    "other users cannot read or mutate another user records",
    async () => {
      assert.equal(
        (await db.query("select * from public.profiles")).rows.length,
        1,
      );
      for (const table of [
        "financial_profiles",
        "financial_profile_members",
        "accounts",
        "transaction_categories",
      ])
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
      assert.equal(
        (
          await db.query(
            "update public.profiles set full_name='Hacked' where id=$1 returning id",
            [alice],
          )
        ).rows.length,
        0,
      );
      for (const table of [
        "financial_profiles",
        "accounts",
        "transaction_categories",
      ]) {
        assert.equal(
          (
            await db.query(
              `update public.${table} set name='Hacked' returning id`,
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (await db.query(`delete from public.${table} returning id`)).rows
            .length,
          0,
        );
      }
    },
  );
  await t.test(
    "forged owners, foreign profile IDs and self enrollment rejected",
    async () => {
      await assert.rejects(
        db.query(
          "insert into public.financial_profiles(owner_id,name,kind) values($1,'Forged','CPF')",
          [alice],
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query(
          "insert into public.accounts(financial_profile_id,name) values($1,'Forged account')",
          [profile],
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query(
          "insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Forged category','expense')",
          [profile],
        ),
        /row-level security/,
      );
      await assert.rejects(
        db.query(
          "insert into public.financial_profile_members(financial_profile_id,user_id,role) values($1,$2,'owner')",
          [profile, bob],
        ),
        /permission denied/,
      );
    },
  );
  await asUser(alice);
  await t.test(
    "ownership, membership and financial parent IDs are immutable via API",
    async () => {
      await assert.rejects(
        db.query("update public.financial_profiles set owner_id=$1", [bob]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update public.financial_profile_members set role='editor'"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("delete from public.financial_profile_members"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("update public.accounts set financial_profile_id=$1", [
          profile,
        ]),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "update public.transaction_categories set financial_profile_id=$1",
          [profile],
        ),
        /permission denied/,
      );
    },
  );
  await t.test("owner may update own rows; money stays decimal", async () => {
    assert.equal(
      (
        await db.query<{ value: string }>(
          "update public.accounts set opening_balance=0.10+0.20 returning opening_balance::text as value",
        )
      ).rows[0].value,
      "0.30",
    );
    assert.equal(
      (
        await db.query(
          "update public.financial_profiles set name='Pessoal' returning id",
        )
      ).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        "insert into public.accounts(financial_profile_id,name,opening_balance) values($1,'Invalid','NaN')",
        [profile],
      ),
      /check constraint/,
    );
  });
  await t.test(
    "explicitly authorized viewers are read-only; revocation takes effect",
    async () => {
      await db.exec("reset role");
      await db.query(
        "insert into public.financial_profile_members(financial_profile_id,user_id,role) values($1,$2,'viewer')",
        [profile, viewer],
      );
      await asUser(viewer);
      assert.equal(
        (await db.query("select * from public.accounts")).rows.length,
        1,
      );
      assert.equal(
        (
          await db.query(
            "update public.accounts set name='Viewer edit' returning id",
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "delete from public.transaction_categories returning id",
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query(
          "insert into public.accounts(financial_profile_id,name) values($1,'Viewer insert')",
          [profile],
        ),
        /row-level security/,
      );
      await db.exec("reset role");
      await db.query(
        "delete from public.financial_profile_members where user_id=$1",
        [viewer],
      );
      await asUser(viewer);
      assert.equal(
        (await db.query("select * from public.accounts")).rows.length,
        0,
      );
    },
  );
  await t.test(
    "deleting a profile cascades without orphaned financial data",
    async () => {
      await asUser(alice);
      await db.query("delete from public.financial_profiles where id=$1", [
        profile,
      ]);
      await db.exec("reset role");
      for (const table of [
        "financial_profile_members",
        "accounts",
        "transaction_categories",
      ])
        assert.equal(
          (await db.query(`select * from public.${table}`)).rows.length,
          0,
        );
    },
  );
  await db.close();
});
