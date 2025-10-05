// Arquivo: app/api/attendees/ticketless/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin';

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
    
    // Novos parâmetros para o filtro de data
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');

    // Lógica principal: Busca apenas attendees que NÃO TÊM NENHUM ticket.
    let query = sbAdmin
      .from('attendees')
      .select('id, name, created_at, tickets!left(id)', { count: 'exact' })
      .is('tickets.id', null); // Garante que só vêm participantes sem NENHUM ticket

    // Aplica o filtro de pesquisa por nome
    if (q) {
      query = query.ilike('name', `%${q}%`);
    }

    // Aplica os filtros de data, se existirem
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      // Usamos lte (menor ou igual) para incluir o dia final inteiro
      query = query.lte('created_at', `${endDate}T23:59:59`);
    }

    query = query.order('created_at', { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, data, count });

  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}