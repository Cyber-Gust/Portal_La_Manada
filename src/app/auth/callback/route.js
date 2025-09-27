import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Recebe { event, session } do onAuthStateChange e grava/limpa cookie no SSR
export async function POST(req) {
  const res = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) {
          return req.cookies.get(name)?.value;
        },
        set(name, value, options) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name, options) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  try {
    const { event, session } = await req.json();

    if (event === "SIGNED_IN" && session) {
      // seta cookies da sessão no SSR
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }

    if (event === "SIGNED_OUT") {
      await supabase.auth.signOut();
    }
  } catch (e) {
    // body vazio ou inválido? segue vida, devolve ok pra não travar UX
  }

  return res;
}
