// src/app/api/public/ticket-by-payment/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../lib/supabaseAdmin'; // ajuste se não usar alias

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');

    if (!paymentId) {
      return NextResponse.json({ error: 'paymentId obrigatório' }, { status: 400 });
    }

    // Busca ticket pelo payment_id e embute attendee/event para UX
    const { data, error } = await sbAdmin
      .from('tickets')
      .select(`
        id,
        status,
        qr_code_value,
        attendee:attendees ( id, name, email ),
        event:events ( id, name )
      `)
      .eq('payment_id', paymentId)
      .limit(1)
      .maybeSingle(); // <- evita o "Cannot coerce..." quando 0 linhas

    if (error || !data) {
      // Polling suave: não tratar como erro; apenas "ainda não existe"
      return NextResponse.json(
        { found: false, status: 'unknown' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const resp = {
      found: true,
      status: data.status,
      attendee: data.attendee
        ? { id: data.attendee.id, name: data.attendee.name, email: data.attendee.email }
        : null,
      event: data.event ? { id: data.event.id, name: data.event.name } : null,
    };

    // Só expõe o QR quando realmente estiver pago
    if (data.status === 'paid' && data.qr_code_value) {
      resp.qr_code_value = data.qr_code_value;
    }

    return NextResponse.json(resp, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('[ticket-by-payment][GET] erro:', e?.message || e);
    return NextResponse.json({ error: 'Erro inesperado' }, { status: 500 });
  }
}
