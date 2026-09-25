import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseEnv } from "@/lib/env";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const supabase = createServerClient(url, key, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const { data, error } = await supabase.auth.getClaims();
  const protectedRoute =
    request.nextUrl.pathname.startsWith("/app") ||
    request.nextUrl.pathname === "/nova-senha";
  if (protectedRoute && (error || !data?.claims)) {
    const target = new URL("/login", request.url);
    if (request.nextUrl.pathname === "/nova-senha")
      target.searchParams.set("notice", "recovery");
    const redirect = NextResponse.redirect(target);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    response = redirect;
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
export const config = {
  matcher: [
    "/app/:path*",
    "/login",
    "/cadastro",
    "/recuperar-senha",
    "/nova-senha",
    "/auth/:path*",
  ],
};
