// app/page.js
"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useSessionContext } from "@supabase/auth-helpers-react";

export const dynamic = "force-dynamic"; // evita prerender da "/" no build

function RootPageInner() {
  const router = useRouter();
  const search = useSearchParams();
  const { isLoading, session } = useSessionContext();

  // materializa os params como string estável
  const searchStr = search?.toString() || "";

  useEffect(() => {
    if (isLoading) return;

    const params = new URLSearchParams(searchStr);
    const q = params.get("redirectTo") || "";

    // anti-open-redirect
    const safeRedirect =
      q.startsWith("/") && !q.startsWith("//") && !q.startsWith("/http")
        ? q
        : "";

    const target = session
      ? safeRedirect || "/dashboard"
      : (() => {
          const url = new URL("/login", window.location.origin);
          if (safeRedirect) url.searchParams.set("redirectTo", safeRedirect);
          return url.pathname + url.search;
        })();

    const current = window.location.pathname + window.location.search;
    if (current !== target) router.replace(target);
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

export default function RootPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
          <div className="flex items-center text-lg text-gray-600">
            <Loader2 className="animate-spin text-orange-600 mr-2" size={24} />
            Carregando…
          </div>
        </div>
      }
    >
      <RootPageInner />
    </Suspense>
  );
}
