// app/api/checkin/list/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin';

/**
 * Retorna linhas da view public.checkin_grid
 * Filtros:
 *  - q: busca por attendee_name/email
 *  - only: 'all' | 'in' | 'out'  (mapeado para is_inside true/false)
 * Paginação:
 *  - limit, offset
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const only = url.searchParams.get('only') || 'all';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    let query = sbAdmin
      .from('checkin_grid')
      .select('*', { count: 'exact' });

    if (q) {
      query = query.or(`attendee_name.ilike.%${q}%,attendee_email.ilike.%${q}%`);
    }
    if (only === 'in') {
      query = query.eq('is_inside', true);
    } else if (only === 'out') {
      query = query.eq('is_inside', false);
    }

    query = query.order('last_update', { ascending: false }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // O front já espera: ticket_id, attendee_name, attendee_email, is_inside, is_legendario, qr_code_value
    return NextResponse.json({ success: true, data, count: count ?? (data?.length || 0) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
