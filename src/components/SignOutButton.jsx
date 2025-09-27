// src/components/SignOutButton.jsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { LogOut } from 'lucide-react';

export default function SignOutButton({ className = '', redirectTo = '/login' }) {
  const router = useRouter();
  const supabase = useSupabaseClient();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      // encerra server-side (cookies) e client-side (LocalStorage)
      await fetch('/api/auth/signout', { method: 'POST' }).catch(() => {});
      await supabase.auth.signOut();
    } finally {
      setLoading(false);
      router.replace(redirectTo); // ajuste se seu login for outra rota
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-gray-100 ${className}`}
      title="Sair"
    >
      <LogOut size={16} />
      {loading ? 'Saindo…' : 'Sair'}
    </button>
  );
}
