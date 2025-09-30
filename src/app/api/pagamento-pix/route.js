import { NextResponse } from 'next/server';
import axios from 'axios';
import { getActiveEventId, createPendingTicket } from '../../../lib/commerce';

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || "https://api.asaas.com/v3";
const ASAAS_API_KEY  = process.env.ASAAS_API_KEY;

const asaas = axios.create({
  baseURL: ASAAS_BASE_URL,
  headers: {
    "Content-Type": "application/json",
    "access_token": ASAAS_API_KEY,
    "User-Agent": process.env.ASAAS_USER_AGENT || "LGND-La-Manada/1.0 (+andersonserrano@icloud.com)",
  },
  timeout: 20000,
});

// Funções para controle de data (Adicionadas para robustez do PIX)
const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const thirtyMinutesFromNow = () => new Date(Date.now() + 30 * 60000).toISOString(); // Data/Hora ISO para expiração

export async function POST(request) {
  try {
    const raw = await request.json();
    // CORREÇÃO 1: Inclui valorBase na desestruturação da requisição
    const { customerId, valor, descricao, attendeeId, valorBase } = raw || {};
    
    // Validação do valor base
    if (Number.isNaN(Number(valorBase)) || Number(valorBase) <= 0) {
        return NextResponse.json({ error: 'Valor base (contábil) inválido.' }, { status: 400 });
    }
    
    if (!customerId) return NextResponse.json({ error: 'customerId ausente.' }, { status: 400 });

    const pay = await asaas.post('/payments', {
      customer: customerId,
      billingType: 'PIX',
      value: Number(valor), // Valor com taxas (para Asaas)
      description: descricao || 'Pagamento PIX',
      dueDate: today(),
      pixExpirationDate: thirtyMinutesFromNow(), // Define a expiração do PIX (melhor prática)
    });

    const paymentId = pay?.data?.id;

    // ✅ Cria/garante ticket PENDING (se tiver attendeeId)
    try {
      if (attendeeId && paymentId) {
        const event_id = await getActiveEventId();
        await createPendingTicket({
          event_id,
          attendee_id: attendeeId,
          // CORREÇÃO 2: Usa a variável 'valorBase' que foi desestruturada do 'raw'
          price: Number(valorBase), 
          payment_provider: 'asaas',
          payment_id: paymentId,
          currency: 'BRL',
        });
      }
    } catch (e) {
      // O erro 'body is not defined' foi corrigido.
      console.warn('[PIX][createPendingTicket][warn]', e?.message || e);
    }

    if (!paymentId) return NextResponse.json({ error: 'Falha ao criar pagamento PIX.' }, { status: 502 });

    // pequena espera ajuda no sandbox/produção
    await new Promise(r => setTimeout(r, 400));

    const qr = await asaas.get(`/payments/${paymentId}/pixQrCode`);
    const encoded = qr?.data?.encodedImage || null;
    const pixCopiaECola = qr?.data?.payload || null;
    
    // A imagem QR no formato data URI para ser exibida no frontend
    const qrCodeImage = encoded ? `data:image/png;base64,${encoded}` : null;
    

    return NextResponse.json({ paymentId, qrCodeImage, pixCopiaECola });
  } catch (err) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.data?.errors?.[0]?.description || err.message || 'Erro inesperado';
    return NextResponse.json({ error: msg }, { status });
  }
}
