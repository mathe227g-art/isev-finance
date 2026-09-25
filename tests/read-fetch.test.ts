import { test } from "node:test";
import assert from "node:assert/strict";
import { createReadFetch } from "../src/lib/supabase/read-fetch.ts";
const origin = "https://example.supabase.co";
const rejected = () => Response.json({ code: "PGRST303", message: "JWT issued at future" }, { status: 401 });
test("a future JWT on a table read retries and preserves the successful response", async () => {
  let calls = 0;
  const request = createReadFetch(origin, async () => ++calls === 1 ? rejected() : Response.json({ ok: true }));
  assert.deepEqual(await (await request(origin + "/rest/v1/profiles")).json(), { ok: true });
  assert.equal(calls, 2);
});
test("persistent clock errors stop after three attempts", async () => {
  let calls = 0;
  const request = createReadFetch(origin, async () => { calls++; return rejected(); });
  assert.equal((await request(origin + "/rest/v1/profiles")).status, 401);
  assert.equal(calls, 3);
});
test("writes, RPCs, auth calls and other origins are never replayed", async () => {
  for (const [url, method] of [[origin + "/rest/v1/profiles", "POST"], [origin + "/rest/v1/profiles", "PATCH"], [origin + "/rest/v1/profiles", "DELETE"], [origin + "/rest/v1/rpc/wealth_move", "GET"], [origin + "/auth/v1/user", "GET"], ["https://other.example/rest/v1/profiles", "GET"]]) {
    let calls = 0;
    const request = createReadFetch(origin, async () => { calls++; return rejected(); });
    await request(url, { method });
    assert.equal(calls, 1);
  }
});
test("other authorization failures are returned intact without retry", async () => {
  let calls = 0;
  const request = createReadFetch(origin, async () => { calls++; return Response.json({ code: "PGRST303", message: "JWT expired" }, { status: 401 }); });
  assert.equal((await request(origin + "/rest/v1/profiles")).status, 401);
  assert.equal(calls, 1);
});
