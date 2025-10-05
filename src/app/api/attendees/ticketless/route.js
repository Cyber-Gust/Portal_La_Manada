// Arquivo: app/api/attendees/ticketless/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    // --- CORREÇÃO APLICADA AQUI ---
    // Agora fazemos uma única consulta usando um LEFT JOIN para encontrar
    // attendees onde a correspondência na tabela de tickets é NULA.
    // Esta é a forma correta e mais performática.
    let query = sbAdmin
      .from('attendees')
      .select('id, name, created_at, tickets!left(id)', { count: 'exact' })
      .is('tickets.id', null); // A mágica acontece aqui: filtramos onde o ticket NÃO existe.

    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    // A ordenação e paginação continuam funcionando normalmente
    query = query.order('created_at', { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    // A resposta para o frontend continua a mesma
    return NextResponse.json({ success: true, data, count });

  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}