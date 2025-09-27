// src/lib/commerce.js
// Utilitários server-side para inscrição/pagamento:
// - getActiveEventId()
// - ensureAttendee({...})
// - createPendingTicket({...})

import { sbAdmin } from './supabaseAdmin';

// ---- helpers
const SHIRT_ALLOWED = ['PP','P','M','G','GG','XG'];

const onlyDigits = (s = '') => String(s).replace(/\D/g, '');
const toBool = (v) => {
  if (typeof v === 'boolean') return v;
  if (v == null) return false;
  const t = String(v).trim().toLowerCase();
  return t === 'true' || t === '1' || t === 'sim' || t === 'yes';
};
const normalizeShirtSize = (v) => {
  if (!v) return 'M';
  const x = String(v).trim().toUpperCase();
  // mapeia variações comuns
  const map = { PP: 'PP', P: 'P', M: 'M', G: 'G', GG: 'GG', XG: 'XG', 'X-G': 'XG', 'XGG': 'XG' };
  const out = map[x] || x;
  return SHIRT_ALLOWED.includes(out) ? out : 'M';
};

/**
 * Garante 1 evento ativo. Retorna o id do evento ativo.
 * Se não existir, cria "La Manada".
 */
export async function getActiveEventId() {
  // tenta pegar o mais recente ativo
  const { data: rows, error } = await sbAdmin
    .from('events')
    .select('id')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(`getActiveEventId/select: ${error.message}`);

  if (rows && rows.length > 0) return rows[0].id;

  // cria um default
  const { data: inserted, error: insErr } = await sbAdmin
    .from('events')
    .insert({ name: 'La Manada', is_active: true })
    .select('id')
    .single();

  if (insErr) throw new Error(`getActiveEventId/insert: ${insErr.message}`);
  return inserted.id;
}

/**
 * Cria/atualiza attendee por e-mail (case-insensitive).
 * Retorna o registro completo do attendee.
 */
export async function ensureAttendee({
  name,
  email,
  phone,
  shirt_size,
  is_legendario,
  referral_source,
  notes,
}) {
  if (!name || !email) throw new Error('ensureAttendee: name e email são obrigatórios');

  const shirt = normalizeShirtSize(shirt_size);
  const legend = toBool(is_legendario);
  const phoneDigits = onlyDigits(phone);

  // Busca case-insensitive
  const { data: found, error: findErr } = await sbAdmin
    .from('attendees')
    .select('*')
    .ilike('email', email) // match exato sem case (ilike)
    .limit(1);

  if (findErr) throw new Error(`ensureAttendee/select: ${findErr.message}`);

  if (found && found.length > 0) {
    const existing = found[0];
    const { data: updated, error: upErr } = await sbAdmin
      .from('attendees')
      .update({
        name,
        phone: phoneDigits || existing.phone,
        email, // mantém original informado
        shirt_size: shirt,
        is_legendario: legend,
        referral_source: referral_source ?? existing.referral_source,
        notes: notes ?? existing.notes,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (upErr) throw new Error(`ensureAttendee/update: ${upErr.message}`);
    return updated;
  }

  // Insere novo
  const { data: inserted, error: insErr } = await sbAdmin
    .from('attendees')
    .insert({
      name,
      email,
      phone: phoneDigits,
      shirt_size: shirt,
      is_legendario: legend,
      referral_source: referral_source ?? 'Página Pública',
      notes: notes ?? null,
    })
    .select('*')
    .single();

  if (insErr) {
    // Pode colidir na UNIQUE (lower(email)); tenta re-ler para ser idempotente
    const wasUnique = /duplicate key value/i.test(insErr.message || '');
    if (!wasUnique) throw new Error(`ensureAttendee/insert: ${insErr.message}`);

    const { data: reread, error: reErr } = await sbAdmin
      .from('attendees')
      .select('*')
      .ilike('email', email)
      .limit(1);
    if (reErr) throw new Error(`ensureAttendee/reread: ${reErr.message}`);
    if (reread && reread.length > 0) return reread[0];

    throw new Error('ensureAttendee: falha ao resolver conflito de email');
  }

  return inserted;
}

/**
 * Cria (ou garante) ticket PENDING para (event_id, attendee_id).
 * Respeita a unicidade de "ticket ativo" (pending/paid) por attendee+evento.
 * Se já existir PENDING/PAID, retorna o existente (e faz pequeno update se precisar).
 */
export async function createPendingTicket({
  event_id,
  attendee_id,
  price,
  payment_provider = 'asaas',
  payment_id,
  currency = 'BRL',
}) {
  if (!event_id || !attendee_id) throw new Error('createPendingTicket: event_id e attendee_id são obrigatórios');
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) throw new Error('createPendingTicket: price inválido');

  // 1) Existe ticket "ativo" (pending/paid) para este attendee + evento?
  const { data: existingRows, error: exErr } = await sbAdmin
    .from('tickets')
    .select('id,status,payment_id,price,currency')
    .eq('event_id', event_id)
    .eq('attendee_id', attendee_id)
    .in('status', ['pending', 'paid'])
    .limit(1);

  if (exErr) throw new Error(`createPendingTicket/check: ${exErr.message}`);

  if (existingRows && existingRows.length > 0) {
    const t = existingRows[0];

    // Se já estiver pago, só retorna (compra duplicada pode ser uma feature; aqui evitamos quebrar)
    if (t.status === 'paid') return t;

    // Se estiver pendente, atualiza metadados do pagamento (id, provider) e valor
    const { data: upd, error: updErr } = await sbAdmin
      .from('tickets')
      .update({
        payment_provider,
        payment_id: payment_id ?? t.payment_id,
        payment_status: 'PENDING',
        price: value,
        currency,
        // status continua 'pending'
      })
      .eq('id', t.id)
      .select('id,status,payment_id,price,currency')
      .single();

    if (updErr) throw new Error(`createPendingTicket/update-pending: ${updErr.message}`);
    return upd;
  }

  // 2) Não existe "ativo": cria novo PENDING
  const { data: inserted, error: insErr } = await sbAdmin
    .from('tickets')
    .insert({
      event_id,
      attendee_id,
      status: 'pending',
      price: value,
      currency,
      payment_provider,
      payment_id,
      // qr_code_value só será preenchido no webhook CONFIRMED
    })
    .select('id,status,payment_id,price,currency')
    .single();

  if (insErr) {
    // Se bater na unique parcial (por alguma corrida), tenta re-ler e retornar
    const conflict = /duplicate key value|unique constraint/i.test(insErr.message || '');
    if (!conflict) throw new Error(`createPendingTicket/insert: ${insErr.message}`);

    const { data: reread, error: reErr } = await sbAdmin
      .from('tickets')
      .select('id,status,payment_id,price,currency')
      .eq('event_id', event_id)
      .eq('attendee_id', attendee_id)
      .in('status', ['pending', 'paid'])
      .limit(1);

    if (reErr) throw new Error(`createPendingTicket/reread: ${reErr.message}`);
    if (reread && reread.length > 0) return reread[0];

    throw new Error('createPendingTicket: falha ao resolver conflito de unicidade');
  }

  return inserted;
}
