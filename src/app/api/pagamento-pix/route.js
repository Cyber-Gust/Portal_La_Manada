// app/api/pagamento-pix/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';
import { getActiveEventId, createPendingTicket } from '../../../lib/commerce';

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY  = process.env.ASAAS_API_KEY || "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI1NzZjYzYzLTk2MTQtNDQ5My1hODhmLWNhODU2NGNhZGI0OTo6JGFhY2hfMTExYjBjZTItYTNlZC00OGEwLTgzODktOWY5OGI4NDgxNTU5";

const asaasApi = axios.create({
  baseURL: ASAAS_BASE_URL,
  headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
});

export async function POST(request) {
  try {
    // 👇 Lê o body UMA vez e já pega attendeeId junto
    const raw = await request.json();
    const { customerId, valor, descricao, attendeeId } = raw || {};
    if (!customerId) return NextResponse.json({ error: 'customerId ausente.' }, { status: 400 });

    const today = new Date().toISOString().slice(0, 10);

    const pay = await asaasApi.post('/payments', {
      customer: customerId,
      billingType: 'PIX',
      value: Number(valor),
      description: descricao || 'Pagamento PIX',
      dueDate: today,
    });

    const paymentId = pay?.data?.id;

    // ✅ Cria/garante ticket PENDING (se tiver attendeeId)
    try {
      if (attendeeId && paymentId) {
        const event_id = await getActiveEventId();
        await createPendingTicket({
          event_id,
          attendee_id: attendeeId,
          price: Number(body.valorBase),
          payment_provider: 'asaas',
          payment_id: paymentId,
          currency: 'BRL',
        });
      }
    } catch (e) {
      console.warn('[PIX][createPendingTicket][warn]', e?.message || e);
    }

    if (!paymentId) return NextResponse.json({ error: 'Falha ao criar pagamento PIX.' }, { status: 502 });

    // pequena espera ajuda no sandbox
    await new Promise(r => setTimeout(r, 400));

    const qr = await asaasApi.get(`/payments/${paymentId}/pixQrCode`);
    const encoded = qr?.data?.encodedImage || null;
    const qrCodeImage = encoded ? `data:image/png;base64,${encoded}` : null;
    const pixCopiaECola = qr?.data?.payload || null;

    return NextResponse.json({ paymentId, qrCodeImage, pixCopiaECola });
  } catch (err) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.data?.errors?.[0]?.description || err.message || 'Erro inesperado';
    return NextResponse.json({ error: msg }, { status });
  }
}
