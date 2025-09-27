// app/dashboard/membros/page.js
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import {
  Loader2, Edit, Plus, User, Zap, Mail, RefreshCw, X, Phone,
  Search, Download, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight
} from 'lucide-react';
import RequireAuth from "../../../components/RequireAuth";

const SHIRT_SIZES = ['PP','P','M','G','GG','XG'];
const REFERRALS = ['Amigo', 'Rede Social', 'Ouviu Falar', 'Outro'];

const normalizePhone = (v='') => (v || '').replace(/\D/g, '');
const formatPhone = (v='') => {
  const d = (v || '').replace(/\D/g, '');
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return v;
};

// --- Utils de URL (sincroniza estado <-> URL)
const readURLParams = () => {
  if (typeof window === 'undefined') return { q: '', page: 1, limit: 20 };
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get('q') || '';
  const page = Math.max(parseInt(sp.get('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10), 5), 100);
  return { q, page, limit };
};

const writeURLParams = ({ q, page, limit }) => {
  const sp = new URLSearchParams(window.location.search);
  if (q) sp.set('q', q); else sp.delete('q');
  sp.set('page', String(page));
  sp.set('limit', String(limit));
  const next = `${window.location.pathname}?${sp.toString()}`;
  window.history.replaceState(null, '', next);
};

const MemberFormModal = ({ isOpen, onClose, onSave, initialData }) => {
  const [formData, setFormData] = useState(initialData || {
    name: '', phone: '', email: '', shirt_size: '',
    is_legendario: false, referral_source: '', notes: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData(initialData || {
      name: '', phone: '', email: '', shirt_size: '',
      is_legendario: false, referral_source: '', notes: ''
    });
  }, [initialData, isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    let v = type === 'checkbox' ? checked : value;
    if (name === 'phone') v = normalizePhone(v);
    setFormData(prev => ({ ...prev, [name]: v }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const isEditing = Boolean(initialData?.id);
    const endpoint = isEditing ? `/api/attendees/${initialData.id}` : '/api/attendees';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(endpoint, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409) throw new Error('Este e-mail já está cadastrado.');
        throw new Error(data.error || 'Falha na operação.');
      }
      onSave(data.data);
      onClose();
    } catch (err) {
      alert(`Erro: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-8 rounded-lg shadow-2xl w-full max-w-md">
        <div className="flex justify-between items-center mb-6 border-b pb-2">
          <h2 className="text-2xl font-bold text-orange-600">
            {initialData?.id ? 'Editar Cadastro' : 'Novo Cadastro Manual'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800"><X size={24} /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nome*</label>
            <input name="name" type="text" value={formData.name} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" />
          </div>

          {/* Telefone */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Telefone*</label>
            <div className="mt-1 flex items-center">
              <Phone size={18} className="mr-2 text-orange-600" />
              <input
                name="phone" type="tel" inputMode="numeric" pattern="[0-9]*"
                placeholder="DDD + número (só dígitos)" value={formData.phone}
                onChange={handleChange} required className="block w-full px-3 py-2 border rounded-md"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email*</label>
            <input name="email" type="email" value={formData.email} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border rounded-md" />
          </div>

          {/* Tamanho da camisa */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tamanho da camisa*</label>
            <select name="shirt_size" value={formData.shirt_size} onChange={handleChange} required className="mt-1 block w-full px-3 py-2 border rounded-md">
              <option value="">Selecione</option>
              {SHIRT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Legendário */}
          <div className="flex items-center">
            <input id="is_legendario" name="is_legendario" type="checkbox" checked={formData.is_legendario} onChange={handleChange} className="h-4 w-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500" />
            <label htmlFor="is_legendario" className="ml-2 text-sm font-medium text-gray-700">É Legendário</label>
          </div>

          {/* Como conheceu */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Como conheceu o evento</label>
            <select name="referral_source" value={formData.referral_source} onChange={handleChange} className="mt-1 block w-full px-3 py-2 border rounded-md">
              <option value="">Selecione</option>
              {REFERRALS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-medium text-gray-700">Observações (opcional)</label>
            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className="mt-1 block w-full px-3 py-2 border rounded-md" />
          </div>

          <button type="submit" disabled={loading} className={`w-full flex justify-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white transition-colors ${loading ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default function MembrosPage() {
  // Estado principal
  const initial = readURLParams();
  const [members, setMembers] = useState([]);
  const [q, setQ] = useState(initial.q);
  const [debouncedQ, setDebouncedQ] = useState(initial.q);
  const [page, setPage] = useState(initial.page);
  const [limit, setLimit] = useState(initial.limit);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentMember, setCurrentMember] = useState(null);
  const [err, setErr] = useState('');

  // Debounce da busca (400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQ(q);
      setPage(1); // reset page ao trocar busca
    }, 400);
    return () => clearTimeout(t);
  }, [q]);

  // Sincroniza URL quando page/limit/debouncedQ mudam
  useEffect(() => {
    writeURLParams({ q: debouncedQ, page, limit });
  }, [debouncedQ, page, limit]);

  const totalPages = useMemo(() => Math.max(Math.ceil((count || 0) / limit), 1), [count, limit]);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const url = new URL('/api/attendees', window.location.origin);
      if (debouncedQ) url.searchParams.set('q', debouncedQ);
      url.searchParams.set('limit', String(limit));
      const offset = (page - 1) * limit;
      url.searchParams.set('offset', String(offset));

      const response = await fetch(url.toString(), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || data.success === false) throw new Error(data.error || 'Falha ao carregar.');

      const list = (data.data || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setMembers(list);
      setCount(data.count ?? list.length);
    } catch (error) {
      console.error('Erro ao buscar:', error);
      setErr(error.message);
      setMembers([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page, limit]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const handleOpenCreateModal = () => { setCurrentMember(null); setIsModalOpen(true); };
  const handleOpenEditModal = (member) => { setCurrentMember(member); setIsModalOpen(true); };

  const handleMemberSaved = (saved) => {
    // Pós-criação/edição: refetch pra manter paginação correta
    setIsModalOpen(false);
    setCurrentMember(null);
    fetchMembers();
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este cadastro?')) return;
    try {
      const res = await fetch(`/api/attendees/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || data.success === false) throw new Error(data.error || 'Falha ao excluir.');
      // Se removeu o último item da última página, volta uma página
      const nextCount = Math.max(count - 1, 0);
      const nextTotalPages = Math.max(Math.ceil(nextCount / limit), 1);
      if (page > nextTotalPages) setPage(nextTotalPages);
      else fetchMembers();
    } catch (e) {
      alert(`Erro: ${e.message}`);
    }
  };

  const handleExportCsv = () => {
    const url = new URL('/api/attendees', window.location.origin);
    url.searchParams.set('download', 'csv');
    if (debouncedQ) url.searchParams.set('q', debouncedQ);
    window.location.href = url.toString();
  };

  const onFirst = () => setPage(1);
  const onPrev = () => setPage(p => Math.max(p - 1, 1));
  const onNext = () => setPage(p => Math.min(p + 1, totalPages));
  const onLast = () => setPage(totalPages);

  if (loading && members.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-orange-600 mr-2" />
          <p className="text-gray-600">Carregando lista...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <RequireAuth fallback={<div className="p-6">Verificando acesso…</div>}>
      <DashboardLayout>
        {/* wrapper raiz: evita vazamento lateral dos filhos */}
        <div className="w-full min-w-0">
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
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-lg shadow-md mb-6 overflow-x-auto">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              {/* Filtro por Status */}
              <select
                value={only}
                onChange={(e) => { setOnly(e.target.value); setPage(1); }}
                className="border rounded-lg p-2 focus:ring-orange-500 focus:border-orange-500 shrink-0"
              >
                <option value="all">Todos Pagos</option>
                <option value="in">Apenas Em Evento</option>
                <option value="out">Apenas Fora</option>
              </select>

              {/* Busca */}
              <div className="flex items-center border rounded-lg px-3 min-w-0 max-w-full">
                <Search size={16} className="text-gray-400 mr-2 shrink-0" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar por nome ou email"
                  className="p-2 outline-none w-[220px] sm:w-[280px] md:w-[360px] min-w-0"
                />
              </div>
            </div>

            <button
              onClick={fetchRows}
              className="flex items-center px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors shrink-0"
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
              <table className="min-w-full table-fixed divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[28%]">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[32%]">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[14%]">
                      Tipo
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[12%]">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((r) => (
                    <tr key={r.ticket_id} className={r.is_inside ? 'bg-green-50' : 'hover:bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <div className="flex items-center min-w-0">
                          <User size={18} className="mr-2 text-orange-600 shrink-0" />
                          <span className="truncate block">{r.attendee_name}</span>
                        </div>
                      </td>

                      {/* EMAIL: usa bloco truncável pra não estourar */}
                      <td className="px-6 py-4 text-sm text-gray-500">
                        <div className="min-w-0">
                          <span className="truncate block">{r.attendee_email}</span>
                        </div>
                      </td>

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
          <div className="mt-4 flex flex-wrap md:items-center md:justify-between gap-3">
            <div className="text-sm text-gray-600 min-w-0">
              {count > 0 ? (
                <>
                  Exibindo <span className="font-semibold">{(page - 1) * limit + 1}</span>–
                  <span className="font-semibold">{Math.min(page * limit, count)}</span> de{' '}
                  <span className="font-semibold">{count}</span>
                </>
              ) : (
                <>Nenhum resultado</>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-gray-600">Itens por página:</span>
              <select
                value={limit}
                onChange={(e) => { setLimit(parseInt(e.target.value, 10)); setPage(1); }}
                className="border rounded-lg p-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button onClick={onFirst} disabled={page === 1} className="p-2 rounded border disabled:opacity-40">
                <ChevronsLeft size={16} />
              </button>
              <button onClick={onPrev} disabled={page === 1} className="p-2 rounded border disabled:opacity-40">
                <ChevronLeft size={16} />
              </button>
              <span className="px-3 text-sm text-gray-700">Página {page} de {totalPages}</span>
              <button onClick={onNext} disabled={page >= totalPages} className="p-2 rounded border disabled:opacity-40">
                <ChevronRight size={16} />
              </button>
              <button onClick={onLast} disabled={page >= totalPages} className="p-2 rounded border disabled:opacity-40">
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}
