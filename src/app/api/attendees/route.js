// app/api/attendees/route.js
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../lib/supabaseAdmin';

const SHIRT_SIZES = ['PP','P','M','G','GG','XG'];
const isCsv = (reqUrl) => new URL(reqUrl).searchParams.get('download') === 'csv';

function toCSV(rows) {
  const header = ['id','name','phone','email','shirt_size','is_legendario','referral_source','created_at'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
  };
  return [header.join(','), ...rows.map(r => header.map(h => esc(r[h])).join(','))].join('\n');
}

/**
 * GET /api/attendees
 * q, limit, offset, download=csv
 */
export async function GET(req) {
  try {
    const url = new URL(req.url);
    const q = (url.searchParams.get('q') || '').trim();
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

    let query = sbAdmin.from('attendees').select('*', { count: 'exact' });

    if (q) {
      query = query.or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
    }

    query = query.order('name', { ascending: true }).range(offset, offset + limit - 1);

    const { data, error, count } = await query;
    if (error) throw error;

    if (isCsv(req.url)) {
      const csv = toCSV(data || []);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="attendees.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ success: true, data, count: count ?? (data?.length || 0) });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}

/**
 * POST /api/attendees
 * Cria attendee e, se houver evento ativo, cria automaticamente UM ticket 'pending'
 * para (attendee, evento) — respeitando o índice único.
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const payload = {
      name: String(body.name || '').trim(),
      phone: String(body.phone || '').replace(/\D/g, ''),
      email: String(body.email || '').trim().toLowerCase(),
      shirt_size: String(body.shirt_size || '').trim(),
      is_legendario: !!body.is_legendario,
      referral_source: body.referral_source ? String(body.referral_source) : null,
      notes: body.notes ? String(body.notes) : null,
    };

    if (!payload.name || !payload.phone || !payload.email) {
      return NextResponse.json({ success: false, error: 'Campos obrigatórios: name, phone, email.' }, { status: 400 });
    }
    if (payload.shirt_size && !SHIRT_SIZES.includes(payload.shirt_size)) {
      return NextResponse.json({ success: false, error: 'shirt_size inválido.' }, { status: 400 });
    }

    // 1) Cria attendee
    const { data: attendee, error: insErr } = await sbAdmin
      .from('attendees')
      .insert(payload)
      .select()
      .single();

    if (insErr) {
      if (insErr.code === '23505') {
        return NextResponse.json({ success: false, error: 'Este e-mail já está cadastrado.' }, { status: 409 });
      }
      throw insErr;
    }

    // 2) Localiza evento ativo (mais recente)
    const { data: eventRow, error: evErr } = await sbAdmin
      .from('events')
      .select('id')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // 3) Se houver evento ativo, cria ticket 'pending' (um por attendee+evento)
    if (!evErr && eventRow?.id) {
      // já existe ativo?
      const { data: existing, error: existErr } = await sbAdmin
        .from('tickets')
        .select('id')
        .eq('attendee_id', attendee.id)
        .eq('event_id', eventRow.id)
        .in('status', ['pending','paid'])
        .limit(1);

      if (existErr) throw existErr;

      if (!existing || existing.length === 0) {
        const { error: tkErr } = await sbAdmin.from('tickets').insert({
          attendee_id: attendee.id,
          event_id: eventRow.id,
          status: 'pending',
          price: 0,
          currency: 'BRL',
          // qr_code_value permanece null até pagamento/integração do checkout
        });
        // Se bater em unique, ignora; qualquer outro erro propaga
        if (tkErr && tkErr.code !== '23505') throw tkErr;
      }
    }

    return NextResponse.json({ success: true, data: attendee }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
