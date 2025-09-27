import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../utils/supabase.server';

export async function POST(req) {
  try {
    const { event_id, name, phone, email, shirt_size, referral_source, is_legendario = false, price } = await req.json();
    if (!event_id || !name || !phone || !email || !shirt_size || !price)
      return NextResponse.json({ success:false, error:'Campos obrigatórios ausentes.' }, { status:400 });

    const sb = supabaseAdmin();

    // upsert attendee
    const { data: existing } = await sb.from('attendees').select('id').ilike('email', email).maybeSingle();
    let attendee_id = existing?.id;
    if (!attendee_id) {
      const { data: created, error: attErr } = await sb.from('attendees').insert({
        name, phone: (phone||'').replace(/\D/g,''), email, shirt_size, referral_source, is_legendario
      }).select('id').single();
      if (attErr) throw attErr;
      attendee_id = created.id;
    }

    // cria ticket pending
    const { data: ticket, error: tErr } = await sb.from('tickets').insert({
      event_id, attendee_id, price, status:'pending', currency:'BRL', payment_provider:'asaas'
    }).select('id').single();
    if (tErr) return NextResponse.json({ success:false, error:'Já existe ticket ativo para este e-mail neste evento.' }, { status:409 });

    // cria cobrança no Asaas (stub)
    const payment_id = `asaas_${ticket.id}`;
    const payment_url = `https://pay.asaas.com/${ticket.id}`;

    await sb.from('tickets').update({ payment_id, payment_status:'CREATED' }).eq('id', ticket.id);

    return NextResponse.json({ success:true, data:{ ticket_id: ticket.id, payment_url } }, { status:201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success:false, error:'Falha no checkout', details:e.message }, { status:500 });
  }
}
