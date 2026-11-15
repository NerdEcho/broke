import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return home(origin);
    // The usual cause: the link was opened in a different browser from the one that asked for it.
    console.error("[broke] sign-in link:", /code verifier/i.test(error.message) ? "opened in a different browser from the one that asked for it. Send a new email and open its link in that same browser." : error.message);
  }
  return NextResponse.redirect(`${origin}/login?error=link`);
}

async function home(origin: string) {
  return NextResponse.redirect(`${origin}/`);
}
