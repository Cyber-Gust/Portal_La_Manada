// Arquivo: app/dashboard/gerar-ticket/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Loader2, Ticket, Search, RefreshCw, X } from 'lucide-react';
import RequireAuth from "../../../components/RequireAuth";

// Função para formatar a data que já usamos
const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(isoString));
};

export default function GerarTicketPage() {
  // Estados para os novos filtros
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [limit, setLimit] = useState(20);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [attendees, setAttendees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState(null);

  const fetchTicketlessAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/attendees/ticketless', window.location.origin);
      // Adiciona todos os filtros na URL da API
      if (debouncedQ) url.searchParams.set('q', debouncedQ);
      if (startDate) url.searchParams.set('startDate', startDate);
      if (endDate) url.searchParams.set('endDate', endDate);
      url.searchParams.set('limit', String(limit));
      
      const response = await fetch(url.toString());
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Falha ao carregar.');

      setAttendees(data.data || []);
    } catch (error) {
      console.error('Erro ao buscar:', error);
      alert(`Erro: ${error.message}`);
      setAttendees([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, limit, startDate, endDate]); // Adiciona dependências

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    fetchTicketlessAttendees();
  }, [fetchTicketlessAttendees]);

  const handleGenerateTicket = async (attendeeId) => {
    if (generatingId) return;
    setGeneratingId(attendeeId);
    try {
      const res = await fetch(`/api/attendees/${attendeeId}/create-ticket`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar ticket.');
      alert(`Ticket para o ID ${attendeeId} gerado com sucesso!`);
      setAttendees(prev => prev.filter(a => a.id !== attendeeId));
    } catch (e) {
      alert(`Erro: ${e.message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  const clearFilters = () => {
    setQ('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="w-full">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
            <Ticket className="mr-3" /> Gerar Ticket Manual
          </h1>
          <p className="mb-6 text-gray-600">
            {`Esta página lista apenas os cadastros que ainda não possuem nenhum ticket (nem pago, nem pendente).`}
          </p>

          {/* Barra de Ações com os novos filtros */}
          <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-lg shadow-md mb-6">
            {/* Pesquisa por nome */}
            <div className="flex items-center border rounded-lg px-3 flex-grow min-w-[250px]">
              <Search size={16} className="text-gray-400 mr-2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome..." className="p-2 outline-none w-full"/>
            </div>
            {/* Filtro por data */}
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
              <span className="text-gray-500">até</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="border rounded-lg p-2 text-sm" />
            </div>
            {/* Itens por página */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Itens:</span>
              <select value={limit} onChange={(e) => setLimit(parseInt(e.target.value, 10))} className="border rounded-lg p-2 text-sm">
                {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button onClick={clearFilters} className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300" title="Limpar filtros">
              <X size={16} className="mr-1" /> Limpar
            </button>
          </div>

          {/* Tabela */}
          <div className="overflow-x-auto bg-white rounded-lg shadow-xl">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Nome</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-2/5">Data de Cadastro</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/5">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr><td colSpan="3" className="text-center p-6"><Loader2 className="animate-spin inline mr-2" /> Carregando...</td></tr>
                ) : attendees.length === 0 ? (
                  <tr><td colSpan="3" className="text-center p-6 text-gray-500">Nenhum cadastro sem ticket encontrado para os filtros aplicados.</td></tr>
                ) : (
                  attendees.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{a.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(a.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button onClick={() => handleGenerateTicket(a.id)} disabled={generatingId === a.id} className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400">
                          {generatingId === a.id ? ( <><Loader2 size={16} className="animate-spin mr-2" /> Gerando...</> ) : ( <><Ticket size={16} className="mr-2" /> Gerar Ticket</> )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );
}