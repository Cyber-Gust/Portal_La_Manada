// app/api/checkin/toggle/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin';

/**
 * Body: { qrCodeValue: string, action: "checkin" | "checkout" }
 * Regras:
 *  - ticket.status deve ser 'paid'
 *  - Busca último movimento em checkin_events para evitar duplicidade
 *  - Atualiza legacy flags em tickets (is_check_in, check_in_date) para compat
 *  - Retorna payload amigável pro Scanner
 */
export async function POST(req) {
  try {
    const body = await req.json();
    const qr = String(body.qrCodeValue || '').trim();
    const action = (body.action || 'checkin').toLowerCase();

    if (!qr) {
      return NextResponse.json({ success: false, error: 'qrCodeValue obrigatório.' }, { status: 400 });
    }
    if (!['checkin','checkout'].includes(action)) {
      return NextResponse.json({ success: false, error: 'action inválida.' }, { status: 400 });
    }

    // 1) Localiza ticket pago pelo QR
    const { data: tks, error: eTicket } = await sbAdmin
      .from('tickets')
      .select(`
        id, status, attendee_id, qr_code_value, check_in_date,
        attendee:attendees (
          id, name, email, is_legendario
        )
      `)
      .eq('qr_code_value', qr)
      .single();

    if (eTicket) {
      // 404: QR inexistente
      return NextResponse.json({ success: false, error: 'Ingresso não encontrado para este QR.', code: 'TICKET_NOT_FOUND' }, { status: 404 });
    }
    if (!tks || tks.status !== 'paid') {
      // 402: não pago / inválido pra entrar
      return NextResponse.json({ success: false, error: 'Ingresso não está pago.', code: 'NOT_PAID' }, { status: 402 });
    }

    // 2) Checa último movimento
    const { data: last, error: eLast } = await sbAdmin
      .from('checkin_events')
      .select('direction, at')
      .eq('ticket_id', tks.id)
      .order('at', { ascending: false })
      .limit(1);

    if (eLast) throw eLast;
    const lastDir = last?.[0]?.direction || null;

    if (action === 'checkin' && lastDir === 'in') {
      return NextResponse.json({ success: false, error: 'Este ingresso já está dentro.', code: 'ALREADY_IN' }, { status: 409 });
    }
    if (action === 'checkout' && lastDir !== 'in') {
      return NextResponse.json({ success: false, error: 'Este ingresso não está dentro para fazer check-out.', code: 'NOT_IN' }, { status: 409 });
    }

    // 3) Insere evento
    const direction = action === 'checkin' ? 'in' : 'out';
    const { error: eIns } = await sbAdmin.from('checkin_events').insert({
      ticket_id: tks.id,
      direction,
      // created_by: pode ser preenchido futuramente com auth.uid() lido de um header/JWT
    });
    if (eIns) throw eIns;

    // 4) Atualiza flags legacy em tickets (compat)
    if (direction === 'in') {
      await sbAdmin.from('tickets').update({ is_check_in: true, check_in_date: new Date().toISOString() }).eq('id', tks.id);
    } else {
      await sbAdmin.from('tickets').update({ is_check_in: false }).eq('id', tks.id);
    }

    // 5) Monta retorno para o Scanner
    const ticketPayload = {
      id: tks.id,
      check_in_date: direction === 'in' ? new Date().toISOString() : tks.check_in_date,
      user: {
        name: tks.attendee?.name ?? null,
        is_legendario: !!tks.attendee?.is_legendario,
      },
      qr_code_value: tks.qr_code_value,
    };

    const msg = direction === 'in' ? 'Check-in realizado.' : 'Check-out realizado.';
    return NextResponse.json({ success: true, message: msg, ticket: ticketPayload });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
