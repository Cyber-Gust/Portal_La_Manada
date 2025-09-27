// app/dashboard/checkin/page.js
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import {
  CheckCircle, XCircle, User, Ticket, Loader2, RefreshCw, Zap, Search,
  ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
} from 'lucide-react';
import RequireAuth from "../../../components/RequireAuth";


// ---- helpers de URL (sincroniza estado <-> URL)
const readURLParams = () => {
  if (typeof window === 'undefined') return { q: '', only: 'all', page: 1, limit: 20 };
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get('q') || '';
  const only = ['in', 'out', 'all'].includes(sp.get('only') || '') ? sp.get('only') : 'all';
  const page = Math.max(parseInt(sp.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10), 5), 100);
  return { q, only, page, limit };
};

const writeURLParams = ({ q, only, page, limit }) => {
  const sp = new URLSearchParams(window.location.search);
  if (q) sp.set('q', q); else sp.delete('q');
  sp.set('only', only);
  sp.set('page', String(page));
  sp.set('limit', String(limit));
  const next = `${window.location.pathname}?${sp.toString()}`;
  window.history.replaceState(null, '', next);
};

const CheckinStatus = ({ isInside }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
    isInside ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`}>
    {isInside ? <CheckCircle size={14} className="mr-1" /> : <XCircle size={14} className="mr-1" />}
    {isInside ? 'Em Evento' : 'Fora'}
  </span>
);

const LegendarioStatus = ({ isLegendario }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
    isLegendario ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-800'
  }`}>
    <Zap size={14} className="mr-1" />
    {isLegendario ? 'Legendário' : 'Novo'}
  </span>
);

export default function CheckinManagerPage() {
  // estado inicial lido da URL
  const initial = readURLParams();

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState(initial.q);
  const [debouncedQ, setDebouncedQ] = useState(initial.q);
  const [only, setOnly] = useState(initial.only); // 'all' | 'in' | 'out'
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);
  const [count, setCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  
  // debounce de busca (400ms) e reset de página ao trocar busca
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  // mantém URL em sincronia
  useEffect(() => {
    writeURLParams({ q: debouncedQ, only, page, limit });
  }, [debouncedQ, only, page, limit]);

  const totalPages = useMemo(() => Math.max(Math.ceil((count || 0) / limit), 1), [count, limit]);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setErr('');

      const url = new URL('/api/checkin/list', window.location.origin);
      if (debouncedQ) url.searchParams.set('q', debouncedQ);
      if (only !== 'all') url.searchParams.set('only', only);
      url.searchParams.set('limit', String(limit));
      url.searchParams.set('offset', String((page - 1) * limit));

      const res = await fetch(url.toString(), { cache: 'no-store' });
      const json = await res.json();

      if (!res.ok || json.success === false) throw new Error(json.error || 'Falha ao carregar');

      setRows(json.data || []);
      setCount(json.count ?? (json.data?.length || 0));
    } catch (e) {
      setErr(e.message);
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, only, page, limit]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  // Toggle Check-in/Check-out (optimistic)
  const handleToggle = async (row) => {
    const action = row.is_inside ? 'checkout' : 'checkin';
    if (!confirm(`Confirmar ${action.toUpperCase()} para ${row.attendee_name}?`)) return;

    // optimistic
    setRows(prev => prev.map(r => r.ticket_id === row.ticket_id ? { ...r, is_inside: !row.is_inside } : r));

    try {
      const res = await fetch('/api/checkin/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeValue: row.qr_code_value, action }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error || 'Falha na ação');
      }
    } catch (e) {
      alert(`Erro: ${e.message}`);
      // revert
      setRows(prev => prev.map(r => r.ticket_id === row.ticket_id ? { ...r, is_inside: row.is_inside } : r));
    }
  };

  // paginação
  const onFirst = () => setPage(1);
  const onPrev = () => setPage(p => Math.max(p - 1, 1));
  const onNext = () => setPage(p => Math.min(p + 1, totalPages));
  const onLast = () => setPage(totalPages);

  return (
    <RequireAuth fallback={<div className="p-6">Verificando acesso…</div>}>
    <DashboardLayout>
      <h1 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
        <Ticket className="mr-3" /> Gerenciamento de Check-in ({count})
      </h1>

      {/* Alert de erro */}
      {err && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-4 py-3">
          {err}
        </div>
      )}

      {/* Barra de Filtros e Ações */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 bg-white p-4 rounded-lg shadow-md mb-6">
        <div className="flex gap-3 items-center">
          {/* Filtro por Status */}
          <select
            value={only}
            onChange={(e) => { setOnly(e.target.value); setPage(1); }}
            className="border rounded-lg p-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="all">Todos Pagos</option>
            <option value="in">Apenas Em Evento</option>
            <option value="out">Apenas Fora</option>
          </select>

          {/* Busca */}
          <div className="flex items-center border rounded-lg px-3">
            <Search size={16} className="text-gray-400 mr-2" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome ou email"
              className="p-2 outline-none"
            />
          </div>
        </div>

        <button
          onClick={fetchRows}
          className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          title="Atualizar Dados"
        >
          <RefreshCw size={18} className="mr-2" />
          Atualizar
        </button>
      </div>

      {/* Lista / Skeleton */}
      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-orange-600 mr-2" />
          <p className="text-gray-600">Carregando lista...</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow-xl">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ação</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rows.map((r) => (
                <tr key={r.ticket_id} className={r.is_inside ? 'bg-green-50' : 'hover:bg-gray-50'}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 flex items-center">
                    <User size={18} className="mr-2 text-orange-600" />
                    {r.attendee_name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{r.attendee_email}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <CheckinStatus isInside={r.is_inside} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <LegendarioStatus isLegendario={r.is_legendario} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button
                      onClick={() => handleToggle(r)}
                      className={`px-3 py-1 rounded-md text-white font-semibold transition-colors text-xs ${
                        r.is_inside ? 'bg-red-500 hover:bg-red-700' : 'bg-green-500 hover:bg-green-700'
                      }`}
                    >
                      {r.is_inside ? 'Check-out' : 'Check-in'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && !loading && (
            <p className="p-6 text-center text-gray-500">Nenhum pago encontrado no filtro.</p>
          )}
        </div>
      )}

      {/* Paginação */}
      <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="text-sm text-gray-600">
          {count > 0
            ? <>Exibindo <span className="font-semibold">{(page - 1) * limit + 1}</span>–<span className="font-semibold">{Math.min(page * limit, count)}</span> de <span className="font-semibold">{count}</span></>
            : <>Nenhum resultado</>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Itens por página:</span>
          <select
            value={limit}
            onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
            className="border rounded-lg p-2 focus:ring-orange-500 focus:border-orange-500"
          >
            {[10,20,50,100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onFirst} disabled={page === 1} className="p-2 rounded border disabled:opacity-40"><ChevronsLeft size={16} /></button>
          <button onClick={onPrev}  disabled={page === 1} className="p-2 rounded border disabled:opacity-40"><ChevronLeft size={16} /></button>
          <span className="px-3 text-sm text-gray-700">Página {page} de {totalPages}</span>
          <button onClick={onNext} disabled={page >= totalPages} className="p-2 rounded border disabled:opacity-40"><ChevronRight size={16} /></button>
          <button onClick={onLast} disabled={page >= totalPages} className="p-2 rounded border disabled:opacity-40"><ChevronsRight size={16} /></button>
        </div>
      </div>
    </DashboardLayout>
    </RequireAuth>
  );
}
