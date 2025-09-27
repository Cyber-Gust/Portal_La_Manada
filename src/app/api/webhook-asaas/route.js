// src/app/api/webhook-asaas/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../lib/supabaseAdmin';

// --- helpers locais
const MAP_STATUS = (asaasStatus, eventType) => {
  const s = String(asaasStatus || '').toUpperCase();
  const e = String(eventType || '').toUpperCase();

  // Pago no Asaas pode chegar como RECEIVED (PIX) ou CONFIRMED (cartão)
  if (s === 'CONFIRMED' || s === 'RECEIVED' || e === 'PAYMENT_CONFIRMED' || e === 'PAYMENT_RECEIVED') {
    return 'paid';
  }
  if (s === 'PENDING' || e === 'PAYMENT_CREATED' || e === 'PAYMENT_UPDATED') {
    return 'pending';
  }
  if (s === 'REFUNDED' || e === 'PAYMENT_REFUNDED' || s === 'CHARGEBACK' || e === 'PAYMENT_CHARGEBACK') {
    return 'refunded';
  }
  if (s === 'CANCELLED' || e === 'PAYMENT_DELETED' || e === 'PAYMENT_CANCELLED') {
    return 'cancelled';
  }
  return 'pending';
};

const alphaNum = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const genToken = (len = 28) => {
  let out = '';
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += alphaNum[arr[i] % alphaNum.length];
  return out;
};

export async function POST(request) {
  try {
    const body = await request.json();

    console.log('[ASAAS WEBHOOK]',
      'event=', body?.event,
      'paymentId=', body?.payment?.id,
      'status=', body?.payment?.status
    );

    const paymentId = body?.payment?.id;
    const asaasStatus = body?.payment?.status;
    const eventType = body?.event;

    if (!paymentId) {
      console.warn('[WEBHOOK] payload sem paymentId');
      return NextResponse.json({ ok: true, ignored: true });
    }

    const targetStatus = MAP_STATUS(asaasStatus, eventType);

    // Busca ticket deste pagamento (sem estourar erro quando 0 linhas)
    const { data: ticket, error: tErr } = await sbAdmin
      .from('tickets')
      .select('id, status, qr_code_value')
      .eq('payment_id', paymentId)
      .limit(1)
      .maybeSingle();

    if (tErr || !ticket) {
      console.warn('[WEBHOOK] ticket não encontrado para payment_id=', paymentId, 'err=', tErr?.message);
      return NextResponse.json({ ok: true, ticketFound: false });
    }

    const update = {
      payment_status: asaasStatus || eventType || null,
      payment_payload: body ?? null,
      updated_at: new Date().toISOString(),
    };
    if (ticket.status !== targetStatus) {
      update.status = targetStatus;
    }

    // Se virou "paid" e não tem QR ainda, gera com retry anti-colisão
    const mustCreateQr = targetStatus === 'paid' && !ticket.qr_code_value;

    if (!mustCreateQr) {
      const { error: upErr } = await sbAdmin.from('tickets').update(update).eq('id', ticket.id);
      if (upErr) {
        console.error('[WEBHOOK] update simples falhou:', upErr.message);
        return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, updated: true, qrCreated: false });
    }

    let attempts = 0;
    let lastErr = null;
    while (attempts < 5) {
      attempts++;
      const qr = `TKT_${genToken(10)}_${genToken(10)}`;
      const { error: upErr } = await sbAdmin
        .from('tickets')
        .update({ ...update, qr_code_value: qr })
        .eq('id', ticket.id);

      if (!upErr) {
        return NextResponse.json({ ok: true, updated: true, qrCreated: true });
      }

      const msg = upErr?.message || '';
      const isUnique = /duplicate key value|unique constraint|already exists/i.test(msg);
      if (!isUnique) {
        lastErr = upErr;
        break;
      }
      lastErr = upErr; // colisão improvável, tenta outro token
    }

    console.error('[WEBHOOK] falha ao gravar QR após retries:', lastErr?.message);
    return NextResponse.json({ ok: false, error: 'Falha ao gerar QR (colisão repetida).' }, { status: 500 });
  } catch (e) {
    console.error('[WEBHOOK] erro geral:', e?.message || e);
    return NextResponse.json({ error: 'payload inválido' }, { status: 400 });
  }
}
