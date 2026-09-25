import { test } from "node:test";
import assert from "node:assert/strict";
import { wealthDb } from "./helpers/wealth-db.ts";

test("Business workspace keeps contacts, team and audit isolated", async (t) => {
  const x = await wealthDb();
  const { db, as, one, other, foreignAccount, users } = x;
  try {
    let contact = "";
    let income = "";
    await t.test("owner creates a contact and sensitive fields never enter audit", async () => {
      contact = await one("insert into public.business_contacts(financial_profile_id,kind,name,document,email,phone,notes) values($1,'client','Cliente Exemplo','12.345.678/0001-00','financeiro@example.test','11999999999','segredo interno') returning id", [other]);
      const event = (await db.query<{ summary: Record<string,string> }>("select summary from public.financial_activity_log where financial_profile_id=$1 and entity='business_contacts' order by id desc limit 1", [other])).rows[0];
      assert.equal(event.summary.label, "Cliente Exemplo");
      assert.equal(JSON.stringify(event.summary).includes("segredo"), false);
      assert.equal(JSON.stringify(event.summary).includes("financeiro@"), false);
      assert.equal(JSON.stringify(event.summary).includes("12.345"), false);
    });
    await t.test("receivables are grouped by client using decimal values", async () => {
      income = await one("insert into public.transaction_categories(financial_profile_id,name,kind) values($1,'Serviços','income') returning id", [other]);
      await db.query("insert into public.transactions(financial_profile_id,contact_id,account_id,category_id,type,description,amount,transaction_date,due_date,status) values($1,$2,$3,$4,'income','Consultoria',1250.35,'2026-09-24','2026-10-10','pending')", [other, contact, foreignAccount, income]);
      const rows = (await db.query<{ value: { name:string; total:string; items:number }[] }>("select public.business_receivables($1) value", [other])).rows[0].value;
      assert.deepEqual(rows.map((row) => [row.name, row.total, row.items]), [["Cliente Exemplo", "1250.35", 1]]);
    });
    await t.test("only the owner manages access; viewer is read-only", async () => {
      const added = (await db.query<{ id:string }>("select public.profile_add_member_by_email($1,$2,'viewer') id", [other, "user1@example.test"])).rows[0].id;
      assert.equal(added, users[1]);
      const team = (await db.query<{ value:{user_id:string;role:string}[] }>("select public.profile_team($1) value", [other])).rows[0].value;
      assert.deepEqual(team.map((member) => member.role).sort(), ["owner", "viewer"]);
      await as(users[1]);
      assert.equal((await db.query("select * from public.business_contacts where financial_profile_id=$1", [other])).rows.length, 1);
      assert.equal((await db.query("select * from public.financial_activity_log where financial_profile_id=$1", [other])).rows.length > 0, true);
      await assert.rejects(db.query("insert into public.business_contacts(financial_profile_id,kind,name) values($1,'client','Invasão')", [other]));
      await assert.rejects(db.query("select public.profile_add_member_by_email($1,$2,'viewer')", [other, "user2@example.test"]), /Owner access required/);
      await assert.rejects(db.query("select public.profile_remove_member($1,$2)", [other, users[0]]), /Owner access required/);
      await as(users[0]);
      await db.query("select public.profile_remove_member($1,$2)", [other, users[1]]);
      await as(users[1]);
      assert.equal((await db.query("select * from public.business_contacts where financial_profile_id=$1", [other])).rows.length, 0);
    });
    await t.test("anonymous callers cannot execute business functions", async () => {
      await db.exec("reset role; set role anon");
      for (const sql of [
        "select public.business_receivables($1)",
        "select public.profile_team($1)",
        "select public.profile_add_member_by_email($1,'user2@example.test','viewer')",
        "select public.profile_remove_member($1,$2)",
      ]) await assert.rejects(db.query(sql, sql.includes("$2") ? [other, users[2]] : [other]), /permission denied/);
    });
  } finally { await db.close(); }
});
