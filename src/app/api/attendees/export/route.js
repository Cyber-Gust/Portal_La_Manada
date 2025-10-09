// app/api/attendees/export/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin';

function escapeCsv(value = '') {
  const s = String(value ?? '');
  // Se contém aspas, vírgula ou quebra de linha, envolve em aspas e escapa aspas internas
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function onlyDigits(s = '') {
  return String(s || '').replace(/\D/g, '');
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();

    // 1) Se tiver busca, primeiro pego os IDs dos attendees que batem com q
    let attendeeFilterIds = null;
    if (q) {
      const { data: attHits, error: attErr } = await sbAdmin
        .from('attendees')
        .select('id')
        .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
      if (attErr) throw attErr;
      attendeeFilterIds = (attHits || []).map(a => a.id);
      if (attendeeFilterIds.length === 0) {
        // Nada a exportar
        const empty = 'Nome,Telefone,Email,CodigoQR\n';
        return new NextResponse(empty, {
          status: 200,
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': 'attachment; filename="inscritos_pagantes.csv"',
            'Cache-Control': 'no-store',
          },
        });
      }
    }

    // 2) Tickets pagos com join em attendees (pra pegar os dados da pessoa)
    let query = sbAdmin
      .from('tickets')
      .select(`
        id,
        status,
        qr_code_value,
        attendee_id,
        attendee:attendees ( name, phone, email )
      `)
      .eq('status', 'paid');

    if (attendeeFilterIds) {
      query = query.in('attendee_id', attendeeFilterIds);
    }

    const { data: rows, error } = await query;
    if (error) throw error;

    // 3) Monta CSV
    const header = 'Nome,Telefone,Email,CodigoQR\n';
    const body = (rows || [])
      .map(r => {
        const nome = r.attendee?.name ?? '';
        const fone = onlyDigits(r.attendee?.phone ?? ''); // exporto só dígitos p/ WhatsApp
        const email = r.attendee?.email ?? '';
        const qr = r.qr_code_value ?? ''; // só vem se tiver mesmo no ticket
        return [
          escapeCsv(nome),
          escapeCsv(fone),
          escapeCsv(email),
          escapeCsv(qr),
        ].join(',');
      })
      .join('\n');

    const csv = header + body + '\n';

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="inscritos_pagantes.csv"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    console.error('[attendees/export][GET] erro:', e?.message || e);
    return NextResponse.json({ error: 'Falha ao exportar CSV' }, { status: 500 });
  }
}
