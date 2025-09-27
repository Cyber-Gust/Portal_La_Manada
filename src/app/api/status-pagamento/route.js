// app/api/status-pagamento/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';

const ASAAS_BASE_URL = process.env.ASAAS_BASE_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY  = process.env.ASAAS_API_KEY || "$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjI1NzZjYzYzLTk2MTQtNDQ5My1hODhmLWNhODU2NGNhZGI0OTo6JGFhY2hfMTExYjBjZTItYTNlZC00OGEwLTgzODktOWY5OGI4NDgxNTU5";

const asaasApi = axios.create({
  baseURL: ASAAS_BASE_URL,
  headers: { 'Content-Type': 'application/json', access_token: ASAAS_API_KEY },
});

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get('paymentId');
    if (!paymentId) return NextResponse.json({ error: 'paymentId ausente.' }, { status: 400 });

    const { data } = await asaasApi.get(`/payments/${paymentId}`);
    return NextResponse.json({ status: data?.status || 'UNKNOWN' });
  } catch (err) {
    const status = err?.response?.status || 500;
    const msg = err?.response?.data?.errors?.[0]?.description || err.message || 'Erro inesperado';
    return NextResponse.json({ error: msg }, { status });
  }
}
