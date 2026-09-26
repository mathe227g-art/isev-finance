import { test } from "node:test";
import assert from "node:assert/strict";
import { wealthDb } from "./helpers/wealth-db.ts";
test("Phase 5 imports, preferences, subscriptions and tenant isolation", async (t) => {
  const x = await wealthDb();
  const { db, as, save, profile, other, account, category, income, users } = x;
  try {
    await t.test("import is atomic, exact and idempotent", async () => {
      const rows = [
        {
          date: "2026-09-20",
          description: "Mercado",
          amount: "120.35",
          type: "expense",
        },
        {
          date: "2026-09-21",
          description: "Reembolso",
          amount: "50.10",
          type: "income",
        },
      ];
      const first = (
        await db.query<{ value: { imported: number; duplicates: number } }>(
          "select public.finance_import_transactions($1,$2,$3,$4,'extrato.csv','csv',$5) value",
          [profile, account, income, category, JSON.stringify(rows)],
        )
      ).rows[0].value;
      assert.deepEqual([first.imported, first.duplicates], [2, 0]);
      const second = (
        await db.query<{ value: { imported: number; duplicates: number } }>(
          "select public.finance_import_transactions($1,$2,$3,$4,'extrato.csv','csv',$5) value",
          [profile, account, income, category, JSON.stringify(rows)],
        )
      ).rows[0].value;
      assert.deepEqual([second.imported, second.duplicates], [0, 2]);
      const count = (
        await db.query<{ n: number }>(
          "select count(*)::int n from public.transactions where financial_profile_id=$1 and import_fingerprint is not null",
          [profile],
        )
      ).rows[0].n;
      assert.equal(count, 2);
    });
    await t.test(
      "preference belongs to one user and one authorized profile",
      async () => {
        await db.query(
          "insert into public.dashboard_preferences(financial_profile_id,user_id,widget_order) values($1,$2,$3)",
          [profile, users[0], ["safe_spend", "actions"]],
        );
        await as(users[1]);
        assert.equal(
          (await db.query("select * from public.dashboard_preferences")).rows
            .length,
          0,
        );
        await assert.rejects(
          db.query(
            "insert into public.dashboard_preferences(financial_profile_id,user_id) values($1,$2)",
            [profile, users[1]],
          ),
        );
        await as(users[0]);
      },
    );
    await t.test(
      "subscription uses recurrence engine and appears in dashboard",
      async () => {
        await db.query(
          "insert into public.recurring_transactions(financial_profile_id,account_id,category_id,type,description,amount,frequency,due_day,start_date,is_subscription,merchant_name) values($1,$2,$3,'expense','Streaming',49.90,'monthly',10,'2026-09-01',true,'Exemplo')",
          [profile, account, category],
        );
        const data = (
          await db.query<{
            value: {
              safe_to_spend: string;
              cashflow: unknown[];
              subscriptions: unknown[];
            };
          }>("select public.customer_dashboard($1,'2026-09-01') value", [
            profile,
          ])
        ).rows[0].value;
        assert.equal(data.subscriptions.length, 1);
        assert.equal(data.cashflow.length, 3);
        assert.equal(typeof data.safe_to_spend, "string");
      },
    );
    await t.test(
      "owner permanently deletes cards, positions and complete profiles",
      async () => {
        const card = await save("card", {
          name: "Excluir",
          institution: "",
          brand: "",
          last_four: "",
          credit_limit: "1000",
          closing_day: 20,
          due_day: 10,
          payment_account_id: account,
          color: "#087DF0",
          active: true,
        });
        const goal = await save("position", {
          kind: "goal",
          name: "Excluir",
          description: "",
          institution: "",
          ticker: "",
          investment_type: "",
          target_amount: "100",
          target_date: "",
          essential_cost: "",
          target_months: "",
          status: "active",
        });
        await db.query("select public.wealth_delete($1,'card',$2)", [
          profile,
          card,
        ]);
        await db.query("select public.wealth_delete($1,'position',$2)", [
          profile,
          goal,
        ]);
        assert.equal(
          (
            await db.query("select id from public.credit_cards where id=$1", [
              card,
            ])
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select id from public.financial_positions where id=$1",
              [goal],
            )
          ).rows.length,
          0,
        );
        await save(
          "card",
          {
            name: "Perfil",
            institution: "",
            brand: "",
            last_four: "",
            credit_limit: "1000",
            closing_day: 20,
            due_day: 10,
            payment_account_id: x.foreignAccount,
            color: "#087DF0",
            active: true,
          },
          null,
          other,
        );
        await db.query("delete from public.financial_profiles where id=$1", [
          other,
        ]);
        assert.equal(
          (
            await db.query(
              "select id from public.credit_cards where financial_profile_id=$1",
              [other],
            )
          ).rows.length,
          0,
        );
      },
    );
    await t.test(
      "cross-profile references and viewer imports are rejected",
      async () => {
        await assert.rejects(
          db.query(
            "select public.finance_import_transactions($1,$2,$3,$4,'x.csv','csv',$5)",
            [
              profile,
              x.foreignAccount,
              income,
              category,
              JSON.stringify([
                {
                  date: "2026-09-20",
                  description: "Teste",
                  amount: "1.00",
                  type: "expense",
                },
              ]),
            ],
          ),
        );
        await db.exec("reset role");
        await db.query(
          "insert into public.financial_profile_members(financial_profile_id,user_id,role) values($1,$2,'viewer')",
          [profile, users[1]],
        );
        await as(users[1]);
        await assert.rejects(
          db.query(
            "select public.finance_import_transactions($1,$2,$3,$4,'x.csv','csv',$5)",
            [
              profile,
              account,
              income,
              category,
              JSON.stringify([
                {
                  date: "2026-09-20",
                  description: "Teste",
                  amount: "1.00",
                  type: "expense",
                },
              ]),
            ],
          ),
        );
        assert.equal(
          (
            await db.query(
              "select public.customer_dashboard($1,'2026-09-01')",
              [profile],
            )
          ).rows.length,
          1,
        );
        await assert.rejects(
          db.query("select public.customer_dashboard($1,'2026-09-01')", [
            other,
          ]),
        );
      },
    );
  } finally {
    await db.close();
  }
});
