// app/page.js
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSessionContext } from "@supabase/auth-helpers-react";

export default function RootPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { isLoading, session } = useSessionContext();

  // <<< chave do sucesso: materializa os params como string estável >>>
  const searchStr = search?.toString() || "";

  useEffect(() => {
    if (isLoading) return;

    // lê a partir da string estável (evita objeto novo a cada render)
    const params = new URLSearchParams(searchStr);
    const q = params.get("redirectTo") || "";

    // sanitiza o redirect
    const safeRedirect =
      q.startsWith("/") && !q.startsWith("//") && !q.startsWith("/http")
        ? q
        : "";

    // calcula destino final e evita replace redundante
    const target = session ? (safeRedirect || "/dashboard") : (() => {
      const url = new URL("/login", window.location.origin);
      if (safeRedirect) url.searchParams.set("redirectTo", safeRedirect);
      return url.pathname + url.search;
    })();

    // só navega se realmente mudou (senão vira loop de no-op)
    const currentPathWithSearch = window.location.pathname + window.location.search;
    if (currentPathWithSearch !== target) {
      router.replace(target);
    }
  }, [isLoading, session, router, searchStr]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <div className="flex items-center text-lg text-gray-600">
        <Loader2 className="animate-spin text-orange-600 mr-2" size={24} />
        Redirecionando…
      </div>
    </div>
  );
}
