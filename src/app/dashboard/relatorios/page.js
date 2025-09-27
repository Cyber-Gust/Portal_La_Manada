// app/dashboard/relatorios/page.js
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import DashboardLayout from "../../../components/DashboardLayout";
import {
  RefreshCw,
  CheckCircle,
  Users,
  ScanLine,
  Calendar,
  AlertCircle,
  Download, // ⬅️ novo ícone
} from "lucide-react";
import RequireAuth from "../../../components/RequireAuth";

// --- helpers
const formatBRL = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (iso, days) => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

// período default: últimos 30 dias (inclusive hoje)
const defaultTo = todayISO();
const defaultFrom = addDaysISO(defaultTo, -29);

// URL <-> estado
const readURLParams = () => {
  if (typeof window === "undefined") return { from: defaultFrom, to: defaultTo };
  const sp = new URLSearchParams(window.location.search);
  const from = sp.get("from") || defaultFrom;
  const to = sp.get("to") || defaultTo;
  return { from, to };
};
const writeURLParams = ({ from, to }) => {
  const sp = new URLSearchParams(window.location.search);
  if (from) sp.set("from", from);
  if (to) sp.set("to", to);
  const next = `${window.location.pathname}?${sp.toString()}`;
  window.history.replaceState(null, "", next);
};

// --- UI
function StatCard({ title, value, icon: Icon, borderClass = "border-orange-600", iconClass = "text-orange-600" }) {
  return (
    <div className={`p-6 bg-white rounded-lg shadow-lg border-t-4 ${borderClass}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        <Icon size={36} className={iconClass} />
      </div>
    </div>
  );
}

export default function RelatoriosPage() {
  // estado inicial a partir da URL
  const initial = readURLParams();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);

  // opcional: se quiser filtrar por evento em /api/relatorios?event_id=...
  const [eventId] = useState(null);

  const [summary, setSummary] = useState(null);
  const [legend, setLegend] = useState(null);
  const [sales, setSales] = useState([]); // sales_by_day (quando from/to enviados)
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // sincroniza URL quando período muda
  useEffect(() => {
    writeURLParams({ from, to });
  }, [from, to]);

  const fetchReports = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");

      const url = new URL("/api/relatorios", window.location.origin);
      if (from) url.searchParams.set("from", from);
      if (to) url.searchParams.set("to", to);
      if (eventId) url.searchParams.set("event_id", eventId);

      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.error || "Falha ao carregar relatórios");

      setSummary(json.data?.summary || null);
      setLegend(json.data?.legend || null);
      setSales(json.data?.sales || []);
    } catch (e) {
      setErr(e.message);
      setSummary(null);
      setLegend(null);
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [from, to, eventId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // ⬇️ novo: handler do CSV
  const handleDownloadCSV = () => {
    const url = new URL("/api/relatorios", window.location.origin);
    if (from) url.searchParams.set("from", from);
    if (to) url.searchParams.set("to", to);
    if (eventId) url.searchParams.set("event_id", eventId);
    url.searchParams.set("download", "csv");
    // abre o download
    window.location.href = url.toString();
  };

  const cards = useMemo(() => {
    const s = summary || {};
    return [
      { title: "Pagos", value: String(s.total_pagos ?? "—"), icon: CheckCircle, borderClass: "border-emerald-600", iconClass: "text-emerald-600" },
      { title: "Pendentes", value: String(s.total_pendentes ?? "—"), icon: AlertCircle, borderClass: "border-amber-600", iconClass: "text-amber-600" },
      { title: "Em check-in", value: String(s.total_em_checkin ?? "—"), icon: ScanLine, borderClass: "border-sky-600", iconClass: "text-sky-600" },
      { title: "Cadastrados (ativos)", value: String(s.total_tickets_ativos ?? "—"), icon: Users, borderClass: "border-orange-600", iconClass: "text-orange-600" },
    ];
  }, [summary]);

  // colunas dinâmicas para sales_by_day (flexível)
  const salesColumns = useMemo(() => {
    const sample = sales?.[0] || {};
    const dateKey = ["dia", "date", "day"].find((k) => k in sample) || "dia";
    const paidKey = ["pagos", "total_pagos", "tickets", "count"].find((k) => k in sample) || null;
    const revenueKey = ["receita", "receita_dia", "revenue"].find((k) => k in sample) || null;
    return { dateKey, paidKey, revenueKey };
  }, [sales]);

  return (
    <RequireAuth fallback={<div className="p-6">Verificando acesso…</div>}>
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-800">Relatórios</h1>
        <div className="flex gap-2 items-center">
          <div className="flex items-center gap-2 border rounded-lg px-3 py-2">
            <Calendar size={16} className="text-gray-500" />
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="outline-none"
              max={to || todayISO()}
            />
            <span className="text-gray-400">—</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="outline-none"
              min={from}
              max={todayISO()}
            />
          </div>

          <button
            onClick={fetchReports}
            className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            disabled={loading}
            title="Atualizar"
          >
            <RefreshCw size={18} className="mr-2" />
            Atualizar
          </button>

          {/* ⬇️ Botão Exportar CSV */}
          <button
            onClick={handleDownloadCSV}
            className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            title="Exportar CSV (vendas por dia)"
          >
            <Download size={18} className="mr-2" />
            Exportar CSV
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          {err}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="p-6 bg-white rounded-lg shadow-lg border-t-4 border-gray-200 animate-pulse">
                <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                <div className="h-8 w-16 bg-gray-200 rounded" />
              </div>
            ))
          : cards.map((c) => <StatCard key={c.title} {...c} />)}
      </div>

      {/* Receita + Quebra por perfil */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-lg">
          <p className="text-sm text-gray-500 mb-1">Receita confirmada (total)</p>
          <p className="text-3xl font-bold">{formatBRL(summary?.receita_confirmada)}</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-lg lg:col-span-2">
          <p className="text-sm text-gray-500 mb-3">Pagos por perfil</p>
          <div className="flex gap-6">
            <div className="flex-1">
              <p className="text-xs uppercase text-gray-400">Legendários</p>
              <p className="text-2xl font-semibold text-orange-700">{legend?.legendarios_pagos ?? "—"}</p>
            </div>
            <div className="flex-1">
              <p className="text-xs uppercase text-gray-400">Não-legendários</p>
              <p className="text-2xl font-semibold text-gray-700">{legend?.nao_legendarios_pagos ?? "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabela de vendas por dia */}
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold text-gray-800">Vendas por dia</h2>
          <p className="text-sm text-gray-500">
            Período: <span className="font-medium">{from}</span> — <span className="font-medium">{to}</span>
          </p>
        </div>

        {loading ? (
          <div className="h-40 flex items-center justify-center">
            <span className="text-gray-500">Carregando série...</span>
          </div>
        ) : sales.length === 0 ? (
          <p className="text-gray-500">Sem dados para o período selecionado.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Dia
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pagos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receita
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((row, idx) => {
                  const { dateKey, paidKey, revenueKey } = salesColumns;
                  const dia = row[dateKey];
                  const pagos = paidKey ? row[paidKey] : undefined;
                  const receita = revenueKey ? row[revenueKey] : undefined;
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-800">{dia}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-800">{pagos ?? "—"}</td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-800">
                        {revenueKey ? formatBRL(receita) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
    </RequireAuth>
  );
}
