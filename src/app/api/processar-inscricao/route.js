// app/api/processar-inscricao/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';
import { ensureAttendee } from '../../../lib/commerce';

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY  = process.env.ASAAS_API_KEY || "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI1NzZjYzYzLTk2MTQtNDQ5My1hODhmLWNhODU2NGNhZGI0OTo6JGFhY2hfMTExYjBjZTItYTNlZC00OGEwLTgzODktOWY5OGI4NDgxNTU5";

const asaasApi = axios.create({
  baseURL: ASAAS_BASE_URL,
  headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
});

const onlyDigits = (s='') => String(s).replace(/\D/g, '');

export async function POST(request) {
  try {
    const form = await request.json();
    const { nome, sobrenome, email, cpfCnpj, telefone } = form ?? {};
    const name = `${nome ?? ''} ${sobrenome ?? ''}`.trim();
    const cpfCnpjClean = onlyDigits(cpfCnpj);
    const phoneClean = onlyDigits(telefone);

    if (!name || !email || !cpfCnpjClean) {
      return NextResponse.json({ error: 'Dados inválidos.' }, { status: 400 });
    }

    const { data } = await asaasApi.post('/customers', {
      name,
      email,
      cpfCnpj: cpfCnpjClean,
      mobilePhone: phoneClean,
      // opcional: postalCode, address, addressNumber...
    });

    if (!data?.id) {
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

    return NextResponse.json({ customerId: data.id, attendeeId });
  } catch (err) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.data?.errors?.[0]?.description || err.message || 'Erro inesperado';
    return NextResponse.json({ error: msg }, { status });
  }
}
