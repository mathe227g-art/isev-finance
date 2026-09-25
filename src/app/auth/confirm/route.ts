import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/env";
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("error"))
    return NextResponse.redirect(new URL("/login?notice=oauth", appUrl()));
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  // Support the standard Supabase email template as well as token_hash links.
  // PKCE requires the same browser that initiated signup/recovery.
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = request.nextUrl.searchParams.get("next");
      const destination = next === "/nova-senha" ? "/nova-senha" : "/app";
      const response = NextResponse.redirect(new URL(destination, appUrl()));
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
    return NextResponse.redirect(new URL("/login?notice=expired", appUrl()));
  }
  if (token_hash && (type === "signup" || type === "recovery")) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (!error) {
      const response = NextResponse.redirect(
        new URL(type === "recovery" ? "/nova-senha" : "/app", appUrl()),
      );
      response.headers.set("Cache-Control", "no-store");
      return response;
    }
  }
  return NextResponse.redirect(new URL("/login?notice=expired", appUrl()));
}
