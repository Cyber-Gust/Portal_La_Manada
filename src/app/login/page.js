"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClient, useUser } from "@supabase/auth-helpers-react";

export default function LoginPage() {
  const supabase = useSupabaseClient();
  const user = useUser();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  // Se já está logado, sai do login
  useEffect(() => {
    if (user) router.replace("/dashboard");
  }, [user, router]);

  // Listener de auth pra garantir redirect (evita race condition)
  useEffect(() => {
    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN") {
        try {
          await fetch("/auth/callback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({ event: "SIGNED_IN", session }),
          });
        } catch (_) {}

        const sp = new URLSearchParams(window.location.search);
        const to = sp.get("redirectTo") || "/dashboard";
        window.location.assign(to);
      }
    });

    return () => {
      try {
        subscription?.subscription?.unsubscribe?.();
      } catch {}
    };
  }, [supabase]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setMessage("");

    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(`Erro: ${error.message}`);
      setLoading(false);
      return;
    }

    // redundância: já tem onAuthStateChange acima,
    // mas se quiser garantir cookie mesmo que o evento não dispare rápido:
    try {
      await fetch("/auth/callback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ event: "SIGNED_IN", session: data?.session }),
      });
    } catch (_) {}

    // redireciona caso o listener não pegue
    const sp = new URLSearchParams(window.location.search);
    const to = sp.get("redirectTo") || "/dashboard";
    window.location.assign(to);
    setLoading(false);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center"
      style={{ backgroundImage: "url('/bg_login.jpg')" }}
    >
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-center text-orange-600 mb-6">
          La Manada - Acesso Legendário
        </h2>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Senha
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-orange-500 focus:border-orange-500 sm:text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white ${
              loading
                ? "bg-orange-400 cursor-not-allowed"
                : "bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            }`}
          >
            {loading ? "Aguarde..." : "Fazer Login"}
          </button>
        </form>

        {message && (
          <p
            className={`mt-4 text-center text-sm ${
              message.startsWith("Erro") ? "text-red-500" : "text-green-600"
            }`}
            aria-live="polite"
          >
            {message}
          </p>
        )}

        <p className="mt-4 text-center text-sm text-gray-600">
          <a href="/cadastro" className="font-medium text-orange-600 hover:text-orange-500">
            Ainda não tem conta? Cadastre-se
          </a>
        </p>
      </div>
    </div>
  );
}
