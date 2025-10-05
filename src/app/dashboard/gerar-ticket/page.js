// Arquivo: app/dashboard/gerar-ticket/page.js
"use client";

import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '../../../components/DashboardLayout';
import { Loader2, Ticket, Search, RefreshCw } from 'lucide-react';
import RequireAuth from "../../../components/RequireAuth";

// Função para formatar a data
const formatDateTime = (isoString) => {
  if (!isoString) return '—';
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(isoString));
  } catch (e) {
    return 'Data inválida';
  }
};

export default function GerarTicketPage() {
  const [attendees, setAttendees] = useState([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState(null); // Para o feedback do botão

  const fetchTicketlessAttendees = useCallback(async () => {
    setLoading(true);
    try {
      const url = new URL('/api/attendees/ticketless', window.location.origin);
      if (debouncedQ) url.searchParams.set('q', debouncedQ);
      
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
  }, [debouncedQ]);

  // Debounce da busca
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q), 400);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    fetchTicketlessAttendees();
  }, [fetchTicketlessAttendees]);

  const handleGenerateTicket = async (attendeeId) => {
    if (generatingId) return; // Previne duplo clique
    setGeneratingId(attendeeId);
    
    try {
      const res = await fetch(`/api/attendees/${attendeeId}/create-ticket`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Falha ao gerar ticket.');

      alert(`Ticket para o ID ${attendeeId} gerado com sucesso!`);
      // Remove o usuário da lista para o admin saber que funcionou
      setAttendees(prev => prev.filter(a => a.id !== attendeeId));

    } catch (e) {
      alert(`Erro: ${e.message}`);
    } finally {
      setGeneratingId(null);
    }
  };

  return (
    <RequireAuth>
      <DashboardLayout>
        <div className="w-full">
          <h1 className="text-3xl font-extrabold text-gray-800 mb-6 flex items-center">
            <Ticket className="mr-3" /> Gerar Ticket Manual
          </h1>
          <p className="mb-6 text-gray-600">
            {/* --- CORREÇÃO DEFINITIVA APLICADA AQUI --- */}
            {`Esta página lista apenas os cadastros que ainda não possuem um ticket de entrada. Use o botão "Gerar Ticket" para criar um ingresso pago manualmente.`}
          </p>

          {/* Barra de Ações */}
          <div className="flex items-center gap-3 bg-white p-4 rounded-lg shadow-md mb-6">
            <div className="flex items-center border rounded-lg px-3 flex-grow">
              <Search size={16} className="text-gray-400 mr-2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por nome..."
                className="p-2 outline-none w-full"
              />
            </div>
            <button
              onClick={fetchTicketlessAttendees}
              className="flex items-center px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              title="Atualizar lista"
            >
              <RefreshCw size={18} />
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
                  <tr><td colSpan="3" className="text-center p-6 text-gray-500">Nenhum cadastro sem ticket encontrado.</td></tr>
                ) : (
                  attendees.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{a.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateTime(a.created_at)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleGenerateTicket(a.id)}
                          disabled={generatingId === a.id}
                          className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                        >
                          {generatingId === a.id ? (
                            <><Loader2 size={16} className="animate-spin mr-2" /> Gerando...</>
                          ) : (
                            <><Ticket size={16} className="mr-2" /> Gerar Ticket</>
                          )}
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