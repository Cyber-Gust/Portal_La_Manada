// app/api/sandbox/pagar-qr/route.js
import { NextResponse } from 'next/server';
import axios from 'axios';

const asaas = axios.create({
  baseURL: process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3',
  headers: { 'Content-Type': 'application/json', access_token: process.env.ASAAS_API_KEY || "$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjljOWIzZDA4LTk0NzMtNDBkZS1hMDNiLWY1Y2VkZjM4OTNlNjo6JGFhY2hfYWU5ZjZhYjctNGYyOC00YzRmLWE0NzEtMjRkMGViZjA5YTI0" },
});

export async function POST(req) {
  const { payload, value } = await req.json();
  if (!payload) return NextResponse.json({ error: 'payload obrigatório' }, { status: 400 });
  try {
    const { data } = await asaas.post('/pix/qrCodes/pay', {
      qrCode: { payload },
      value: value ? Number(value) : undefined,
    });
    return NextResponse.json({ ok: true, simulation: data });
  } catch (e) {
    const msg = e?.response?.data || e.message;
    return NextResponse.json({ error: msg }, { status: e?.response?.status || 500 });
  }
}
