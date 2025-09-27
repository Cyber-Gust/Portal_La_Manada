// app/api/pagamento-cartao/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';
import { getActiveEventId, createPendingTicket } from '../../../lib/commerce';

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY  = process.env.ASAAS_API_KEY || "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI1NzZjYzYzLTk2MTQtNDQ5My1hODhmLWNhODU2NGNhZGI0OTo6JGFhY2hfMTExYjBjZTItYTNlZC00OGEwLTgzODktOWY5OGI4NDgxNTU5";

const SANDBOX_DEFAULT_POSTAL_CODE = process.env.SANDBOX_DEFAULT_POSTAL_CODE || '30130010';
const SANDBOX_DEFAULT_ADDRESS_NUM = process.env.SANDBOX_DEFAULT_ADDRESS_NUM || '100';
const SANDBOX_DEFAULT_PHONE       = process.env.SANDBOX_DEFAULT_PHONE       || '31999999999';

const asaas = axios.create({
  baseURL: ASAAS_BASE_URL,
  headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
});

const onlyDigits = (s='') => String(s).replace(/\D/g, '');
const today = () => new Date().toISOString().slice(0, 10);
const isSandbox = () => (ASAAS_BASE_URL || '').includes('api-sandbox');

export async function POST(request) {
  const raw = await request.json().catch(() => ({}));

  const body = {
    customerId: String(raw?.customerId || '').trim(),
    valor: Number(raw?.valor),
    descricao: raw?.descricao || 'Pagamento Cartão',
    installments: Number(raw?.installments) || 1,
    // 👇👇👇 ÚNICA LINHA NOVA (propaga attendeeId para o body)
    attendeeId: raw?.attendeeId || null,
    card: {
      holderName: String(raw?.card?.holderName || '').trim(),
      number: onlyDigits(String(raw?.card?.number || '')),
      expiryMonth: String(raw?.card?.expiryMonth || '').trim(),
      expiryYear: String(raw?.card?.expiryYear || '').trim(),
      ccv: onlyDigits(String(raw?.card?.ccv || '')),
    },
  };

  console.log('[CARTAO][REQ]', JSON.stringify({
    ...body,
    card: { ...body.card, number: '****', ccv: '***' }
  }, null, 2));

  if (!body.customerId) return NextResponse.json({ error: 'Cliente inválido ou não informado.' }, { status: 400 });
  if (!body.card.holderName || !body.card.number || !body.card.expiryMonth || !body.card.expiryYear || !body.card.ccv) {
    return NextResponse.json({ error: 'Preencha todos os campos do cartão (sem máscara).' }, { status: 400 });
  }
  if (Number.isNaN(body.valor) || body.valor <= 0) {
    return NextResponse.json({ error: 'Valor inválido.' }, { status: 400 });
  }
  if (Number.isNaN(body.valorBase) || body.valorBase <= 0) {
    return NextResponse.json({ error: 'Valor base (para registro) inválido.' }, { status: 400 });
  }

  console.log('[CARTAO][ENV]', {
    ASAAS_BASE_URL,
    API_KEY_TAIL: ASAAS_API_KEY ? ASAAS_API_KEY.slice(-6) : null
  });

  // Confere customer e pega dados
  let customer;
  try {
    const chk = await asaas.get(`/customers/${body.customerId}`);
    customer = chk.data || {};
    console.log('[CARTAO][CHECK CUSTOMER][RES]', chk.status, { id: customer.id, name: customer.name, email: customer.email });
  } catch (e) {
    console.error('[CARTAO][CHECK CUSTOMER][ERRO]', e?.response?.status, e?.response?.data);
    return NextResponse.json({
      error: 'Cliente inválido ou não informado.',
      hint: 'Verifique ASAAS_API_KEY/ASAAS_BASE_URL nas rotas.'
    }, { status: 400 });
  }

  // Holder info (usa cadastro + completa no sandbox)
  let holderInfo = {
    name: body.card.holderName || customer.name,
    email: customer.email,
    cpfCnpj: customer.cpfCnpj,
    postalCode: customer.postalCode,
    addressNumber: customer.addressNumber,
    phone: customer.mobilePhone || customer.phone,
  };

  if (isSandbox()) {
    let touched = false;
    if (!holderInfo.postalCode)   { holderInfo.postalCode  = SANDBOX_DEFAULT_POSTAL_CODE; touched = true; }
    if (!holderInfo.addressNumber){ holderInfo.addressNumber = SANDBOX_DEFAULT_ADDRESS_NUM; touched = true; }
    if (!holderInfo.phone)        { holderInfo.phone       = SANDBOX_DEFAULT_PHONE; touched = true; }
    if (touched) console.warn('[CARTAO][HOLDERINFO][SANDBOX-FALLBACK] CEP/número/telefone preenchidos com defaults de sandbox');
  }

  console.log('[CARTAO][HOLDERINFO]', {
    hasCEP: !!holderInfo.postalCode,
    hasNum: !!holderInfo.addressNumber,
    hasPhone: !!holderInfo.phone
  });

  const payload = {
    customer: body.customerId,
    billingType: 'CREDIT_CARD',
    value: body.valor,
    description: body.descricao,
    dueDate: today(),
    installmentCount: body.installments,
    installmentValue: Number((body.valor / body.installments).toFixed(2)),
    creditCard: {
      holderName: body.card.holderName,
      number: body.card.number,
      expiryMonth: body.card.expiryMonth,
      expiryYear: body.card.expiryYear,
      ccv: body.card.ccv,
    },
    creditCardHolderInfo: holderInfo,
    capture: true,
    remoteIp: '127.0.0.1',
  };

  try {
    const payRes = await asaas.post('/payments', payload);
    console.log('[CARTAO][PAGAMENTO][DIRECT][RES]', payRes.status, {
      id: payRes?.data?.id, status: payRes?.data?.status
    });

    // ADD: cria/garante ticket PENDING (se tiver attendeeId)
    try {
      const paymentId = payRes?.data?.id;
      const attendeeId = body?.attendeeId || null; // agora existe no body
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
      console.warn('[CARTAO][createPendingTicket][warn]', e?.message || e);
    }

    return NextResponse.json({
      paymentId: payRes?.data?.id,
      status: payRes?.data?.status
    });
  } catch (err) {
    const status = err?.response?.status || 500;
    const payload = err?.response?.data || err.message;
    const first = err?.response?.data?.errors?.[0];
    let friendly = first?.description || 'Falha no pagamento de cartão.';
    if (first?.code === 'invalid_creditCard' && /CEP|postal/i.test(first?.description || '')) {
      friendly = 'Informe o CEP (postalCode) e o número do endereço do titular do cartão.';
    }
    if (first?.code === 'invalid_billingType') {
      friendly = 'Cartão de crédito não habilitado na sua conta Asaas. Habilite o método no painel.';
    }
    console.error('[CARTAO][ERRO]', status, payload);
    return NextResponse.json({ error: friendly, _raw: first }, { status });
  }
}
