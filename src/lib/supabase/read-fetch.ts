/** Retry only table reads rejected by PostgREST for a newly issued token.
 * Never replay mutations, RPCs, Auth calls, or arbitrary network failures.
 */
export function createReadFetch(origin: string, transport: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const retryable = url.origin === new URL(origin).origin && method === "GET"
      && url.pathname.startsWith("/rest/v1/") && !url.pathname.startsWith("/rest/v1/rpc/");
    const delays = [400, 1000];
    for (let attempt = 0; ; attempt++) {
      const response = await transport(input, init);
      if (!retryable || response.status !== 401 || attempt >= delays.length) return response;
      const failure = await response.clone().json().catch(() => null);
      if (failure?.code !== "PGRST303" || failure?.message !== "JWT issued at future") return response;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
      (init?.signal ?? (input instanceof Request ? input.signal : undefined))?.throwIfAborted();
    }
  };
}
