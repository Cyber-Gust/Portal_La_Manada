'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';

export default function LogoutPage() {
  const router = useRouter();
  const supabase = useSupabaseClient();

  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
        await supabase.auth.signOut();
      } finally {
        router.replace('/login'); // ajuste se precisar
        router.refresh();
      }
    })();
  }, [router, supabase]);

  return <div className="p-6 text-gray-600">Encerrando sessão…</div>;
}
