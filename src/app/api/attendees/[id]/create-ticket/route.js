// Arquivo: app/api/attendees/[id]/create-ticket/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../../../lib/supabaseAdmin';

export async function POST(req, { params }) {
  try {
    const attendeeId = params.id;
    if (!attendeeId) {
      return NextResponse.json({ success: false, error: 'ID do participante ausente.' }, { status: 400 });
    }

    // 1. Encontrar o evento ativo
    const { data: event, error: eventErr } = await sbAdmin
      .from('events')
      .select('id')
      .eq('is_active', true)
      .single();

    if (eventErr || !event) {
      throw new Error('Nenhum evento ativo encontrado.');
    }

    // 2. Garantir que não estamos criando um ticket duplicado
    const { data: existingTicket, error: checkErr } = await sbAdmin
      .from('tickets')
      .select('id')
      .eq('attendee_id', attendeeId)
      .eq('event_id', event.id)
      .maybeSingle();

    if (checkErr) throw checkErr;
    if (existingTicket) {
      return NextResponse.json({ success: false, error: 'Este participante já possui um ticket para este evento.' }, { status: 409 });
    }

    // 3. Gerar valor do QR Code e criar o ticket
    const qrCodeValue = `evt-${event.id}-att-${attendeeId}-${Date.now()}`;
    
    const { data: newTicket, error: insertErr } = await sbAdmin
      .from('tickets')
      .insert({
        attendee_id: attendeeId,
        event_id: event.id,
        status: 'paid', // O ticket já nasce como PAGO
        price: 0, // Preço 0 pois é uma entrada manual/já paga
        currency: 'BRL',
        payment_provider: 'manual', // Indica que foi gerado manualmente
        qr_code_value: qrCodeValue,
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    return NextResponse.json({ success: true, data: newTicket }, { status: 201 });

  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}