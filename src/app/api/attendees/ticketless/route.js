// Arquivo: app/api/attendees/ticketless/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // 1. Pega os IDs de todos os attendees que JÁ TÊM um ticket
    const { data: ticketedAttendees, error: ticketErr } = await sbAdmin
      .from('tickets')
      .select('attendee_id');

    if (ticketErr) throw new Error(`Falha ao buscar IDs de tickets: ${ticketErr.message}`);
    
    const ticketedIds = ticketedAttendees.map(t => t.attendee_id);

    // 2. Busca os attendees cujo ID NÃO ESTÁ na lista de quem já tem ticket
    let query = sbAdmin
      .from('attendees')
      .select('id, name, created_at', { count: 'exact' });

    if (ticketedIds.length > 0) {
      query = query.not('id', 'in', `(${ticketedIds.join(',')})`);
    }
    
    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    query = query.order('created_at', { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data, count });

  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}