// app/api/relatorios/route.js
import { NextResponse } from 'next/server';
import { sbAdmin } from '../../../lib/supabaseAdmin';

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDays = (iso, d) => {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().slice(0, 10);
};
const defaultTo = todayISO();
const defaultFrom = addDays(defaultTo, -29);

const isCsv = (reqUrl) => new URL(reqUrl).searchParams.get('download') === 'csv';

function toCSV(rows) {
  const header = ['dia','pagos','pendentes','receita_dia'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    };
  return [header.join(','), ...rows.map(r => header.map(h => esc(r[h])).join(','))].join('\n');
}

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const from = url.searchParams.get('from') || defaultFrom;
    const to = url.searchParams.get('to') || defaultTo;
    const eventId = url.searchParams.get('event_id'); // opcional

    // 1) Summary (dashboard_summary)
    let sumQ = sbAdmin.from('dashboard_summary').select('*');
    if (eventId) sumQ = sumQ.eq('event_id', eventId);
    const { data: sumRows, error: sumErr } = await sumQ;
    if (sumErr) throw sumErr;
    const summary = sumRows?.[0] || null;

    // 2) Legend breakdown (legendario_breakdown)
    let legQ = sbAdmin.from('legendario_breakdown').select('*');
    if (eventId) legQ = legQ.eq('event_id', eventId);
    const { data: legRows, error: legErr } = await legQ;
    if (legErr) throw legErr;
    const legend = legRows?.[0] || null;

    // 3) Sales by day — filtrando período no lado do app
    // (Se quiser filtrar no SQL, crie outra view com where entre datas pagas)
    let salesQ = sbAdmin
      .from('sales_by_day')
      .select('event_id, dia, pagos, pendentes, receita_dia')
      .order('dia', { ascending: true });

    if (eventId) salesQ = salesQ.eq('event_id', eventId);

    const { data: allSales, error: salesErr } = await salesQ;
    if (salesErr) throw salesErr;

    const sales = (allSales || []).filter((row) => {
      const d = String(row.dia).slice(0, 10);
      return d >= from && d <= to;
    });

    if (isCsv(req.url)) {
      const csv = toCSV(sales);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="vendas_por_dia.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }

    return NextResponse.json({ success: true, data: { summary, legend, sales } });
  } catch (e) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
