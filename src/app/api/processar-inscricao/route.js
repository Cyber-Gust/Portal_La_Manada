import { NextResponse } from 'next/server';
import axios from 'axios';
import { ensureAttendee } from '../../../lib/commerce';

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


const onlyDigits = (s='') => String(s).replace(/\D/g, '');

export async function POST(request) {
  if (!ASAAS_API_KEY) {
    return NextResponse.json({ error: 'ASAAS_API_KEY não configurada no ambiente.' }, { status: 500 });
  }
  try {
    const form = await request.json();
    const { nome, sobrenome, email, cpfCnpj, telefone } = form ?? {};
    const name = `${nome ?? ''} ${sobrenome ?? ''}`.trim();
    const cpfCnpjClean = onlyDigits(cpfCnpj);
    const phoneClean = onlyDigits(telefone);
    
    // Log the data being processed for debugging
    console.log('[INSCRICAO][INPUT]', { name, email, cpfCnpjClean, phoneClean });

    if (!name || !email || !cpfCnpjClean) {
      console.error('[INSCRICAO][VALIDATION ERROR] Required fields missing.');
      // Mensagem de erro mais clara para o cliente
      return NextResponse.json({ error: 'Nome, E-mail ou CPF/CNPJ ausentes ou inválidos.' }, { status: 400 });
    }

    const customerPayload = {
      name,
      email,
      cpfCnpj: cpfCnpjClean,
      mobilePhone: phoneClean,
      // opcional: postalCode, address, addressNumber...
    };

    console.log('[INSCRICAO][ASAAS SEND]', customerPayload);
    
    const { data } = await asaas.post('/customers', customerPayload);

    if (!data?.id) {
      console.error('[INSCRICAO][ASAAS FAIL] Customer ID missing in response.');
      return NextResponse.json({ error: 'Falha ao criar cliente no Asaas.' }, { status: 502 });
    }

    let attendeeId = null;
    try {
      const attendee = await ensureAttendee({
        name,
        email,
        phone: phoneClean,                // usa versão normalizada
        shirt_size: form?.tamanho,        // normalização é tratada internamente
        is_legendario: form?.legendario,  // "sim/nao" -> boolean (interno)
        referral_source: 'Página Pública',
        notes: `ASAAS customerId: ${data.id}`,
      });
      attendeeId = attendee?.id || null;
    } catch (e) {
      console.warn('[ensureAttendee][warn]', e?.message || e);
    }
    
    console.log('[INSCRICAO][SUCCESS]', { customerId: data.id, attendeeId });

    return NextResponse.json({ customerId: data.id, attendeeId });
  } catch (err) {
    const status = err?.response?.status || 500;
    const firstError = err?.response?.data?.errors?.[0];
    
    // Log detailed error from Asaas response no console
    if (firstError) {
        console.error('[INSCRICAO][ASAAS API ERROR]', status, firstError);
    } else {
        console.error('[INSCRICAO][UNEXPECTED ERROR]', status, err.message);
    }
    
    // Mensagem amigável para o cliente (inclui a descrição do erro Asaas)
    const msg = firstError?.description || err.message || 'Erro inesperado ao processar a inscrição.';
    return NextResponse.json({ error: msg }, { status });
  }
}
