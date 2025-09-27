// components/RequireAuth.jsx
"use client";
import { useEffect } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { useRouter, usePathname } from "next/navigation";

export default function RequireAuth({ children, fallback = null }) {
  const { isLoading, session } = useSessionContext();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace(`/login?redirectTo=${encodeURIComponent(pathname || "/dashboard")}`);
    }
  }, [isLoading, session, pathname, router]);

  if (isLoading) return fallback;
  if (!session) return null;
  return children;
}
