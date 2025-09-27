// src/app/dashboard/page.js
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionContext } from '@supabase/auth-helpers-react';
import DashboardLayout from '../../components/DashboardLayout';
import {
  CheckCircle,
  Users as UsersIcon,
  ScanLine,
  AlertCircle,
} from 'lucide-react';
import RequireAuth from "../../components/RequireAuth";

// ---- helpers
const formatBRL = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(v || 0));

const EVENT_ID = undefined; // plugamos depois se precisar

// ---- UI
function StatCard({ title, value, icon: Icon, borderClass = 'border-orange-600', iconClass = 'text-orange-600' }) {
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

export default function DashboardPage() {
  const router = useRouter();
  const { isLoading, session } = useSessionContext(); // ✅ tem isLoading
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [legend, setLegend] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (isLoading || !session) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        setErr('');
        const url = new URL('/api/relatorios', window.location.origin);
        if (EVENT_ID) url.searchParams.set('event_id', EVENT_ID);

        const res = await fetch(url.toString(), { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok || json.success === false) throw new Error(json.error || 'Falha ao buscar relatórios');

        setSummary(json.data?.summary || null);
        setLegend(json.data?.legend || null);
      } catch (e) {
        setErr(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isLoading, session]);

  const cards = useMemo(() => {
    const s = summary || {};
    return [
      {
        title: 'Cadastrados (ativos)',
        value: String(s.total_tickets_ativos ?? '—'),
        icon: UsersIcon,
        borderClass: 'border-orange-600',
        iconClass: 'text-orange-600',
      },
      {
        title: 'Pagos',
        value: String(s.total_pagos ?? '—'),
        icon: CheckCircle,
        borderClass: 'border-emerald-600',
        iconClass: 'text-emerald-600',
      },
      {
        title: 'Pendentes',
        value: String(s.total_pendentes ?? '—'),
        icon: AlertCircle,
        borderClass: 'border-amber-600',
        iconClass: 'text-amber-600',
      },
      {
        title: 'Em check-in agora',
        value: String(s.total_em_checkin ?? '—'),
        icon: ScanLine,
        borderClass: 'border-sky-600',
        iconClass: 'text-sky-600',
      },
    ];
  }, [summary]);

  // Tela de verificação enquanto o contexto carrega OU enquanto ainda não temos sessão
  if (isLoading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <h1 className="text-xl text-gray-600">Verificando acesso Legendário...</h1>
      </div>
    );
  }

  const userEmail = session?.user?.email ?? '—';

  return (
    <RequireAuth fallback={<div className="p-6">Verificando acesso…</div>}>
      <DashboardLayout>
        {/* Wrapper raiz evita overflow horizontal */}
        <div className="w-full min-w-0">
          {/* Header com wrap (não quebra no mobile) */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6 min-w-0">
            <h1 className="text-3xl font-extrabold text-gray-800">Visão Geral da Manada</h1>
            <div className="text-sm text-gray-500 truncate">
              Logado como <span className="font-semibold">{userEmail}</span>
            </div>
          </div>

          {/* Alert de erro (não quebra se 'err' não existir) */}
          {(typeof err !== "undefined" && err) ? (
            <div className="mb-6 rounded-md border border-red-200 bg-red-50 text-red-700 px-4 py-3">
              {String(err)}
            </div>
          ) : null}

          {/* GRID DE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="p-6 bg-white rounded-lg shadow-lg border-t-4 border-gray-200 animate-pulse"
                  >
                    <div className="h-4 w-24 bg-gray-200 rounded mb-4" />
                    <div className="h-8 w-16 bg-gray-200 rounded" />
                  </div>
                ))
              : cards.map((c) => <StatCard key={c.title} {...c} />)}
          </div>

          {/* Receita e quebras por legendário */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="bg-white p-6 rounded-lg shadow-lg lg:col-span-1">
              <p className="text-sm text-gray-500 mb-1">Receita confirmada</p>
              <p className="text-3xl font-bold">{formatBRL(summary?.receita_confirmada)}</p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-lg lg:col-span-2">
              <p className="text-sm text-gray-500 mb-3">Pagos por perfil</p>
              <div className="flex flex-wrap gap-6 min-w-0">
                <div className="flex-1 min-w-[160px]">
                  <p className="text-xs uppercase text-gray-400">Legendários</p>
                  <p className="text-2xl font-semibold text-orange-700">
                    {legend?.legendarios_pagos ?? '—'}
                  </p>
                </div>
                <div className="flex-1 min-w-[160px]">
                  <p className="text-xs uppercase text-gray-400">Não-legendários</p>
                  <p className="text-2xl font-semibold text-gray-700">
                    {legend?.nao_legendarios_pagos ?? '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    </RequireAuth>
  );

}
