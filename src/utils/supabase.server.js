// src/utils/supabase.server.js
import { createClient } from '@supabase/supabase-js';

export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Env faltando: NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.');
  }

  // Service role (bypass RLS) — use SOMENTE no servidor (rotas /api)
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'X-Client-Info': 'la-manada/api' } },
  });
}

// helpers comuns
export function jsonOk(data, init = 200) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: typeof init === 'number' ? init : 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function jsonErr(message = 'Erro interno', status = 500, extra = {}) {
  if (process.env.NODE_ENV !== 'production') {
    console.error('[API error]', { message, status, ...extra });
  }
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
