"use client";

import { useState } from "react";
import { SessionContextProvider } from "@supabase/auth-helpers-react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function Providers({ children }) {
  const [supabase] = useState(() => createSupabaseBrowser());
  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  );
}
