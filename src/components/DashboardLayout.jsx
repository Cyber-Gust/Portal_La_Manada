// components/DashboardLayout.jsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  X,
  Home,
  Users,
  Ticket,
  BarChart3,
  LogOut,
  QrCode,
  ScanLine,
} from "lucide-react";

const cx = (...cls) => cls.filter(Boolean).join(" ");

const SidebarLink = ({ icon: Icon, text, href, isExpanded, active }) => {
  const base =
    "group relative flex items-center w-full p-3 my-1 rounded-lg transition-colors";
  const activeCls = active
    ? "bg-white text-orange-700"
    : "text-white/90 hover:bg-orange-700 hover:text-white";
  const iconCls = active ? "text-orange-700" : "text-white";

  return (
    <Link
      href={href}
      className={cx(base, activeCls)}
      title={!isExpanded ? text : undefined}
      aria-current={active ? "page" : undefined}
    >
      <Icon size={22} className={cx("shrink-0", iconCls)} />
      {isExpanded && <span className="ml-3 font-medium truncate">{text}</span>}
      {/* Desliga tooltip no mobile pra não causar overflow lateral */}
      <span className="sr-only md:not-sr-only md:pointer-events-none md:absolute md:left-16 md:z-10 md:opacity-0 md:group-hover:opacity-100 md:bg-black/80 md:text-white md:text-xs md:rounded md:px-2 md:py-1 md:translate-y-[-2px]">
        {text}
      </span>
    </Link>
  );
};

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, session } = useSessionContext();

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true); // desktop
  const [isMobileOpen, setIsMobileOpen] = useState(false); // mobile drawer

  const navItems = useMemo(
    () => [
      { icon: Home, text: "Início", href: "/dashboard" },
      { icon: Users, text: "Membros", href: "/dashboard/membros" },
      { icon: ScanLine, text: "Check-in", href: "/dashboard/checkin" },
      { icon: QrCode, text: "Scanner", href: "/dashboard/scanner" },
      { icon: BarChart3, text: "Relatórios", href: "/dashboard/relatorios" },
    ],
    []
  );

  const isActive = (href) =>
    pathname === href ||
    (href !== "/dashboard" && pathname?.startsWith(href));

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace(
        `/login?redirectTo=${encodeURIComponent(pathname || "/dashboard")}`
      );
    }
  }, [isLoading, session, pathname, router]);

  if (isLoading) return <div className="min-h-screen bg-gray-50" />;
  if (!session) return null;

  return (
    // 🔒 Mata vazamento horizontal no nível raiz
    <div className="flex min-h-screen bg-gray-50 overflow-x-hidden">
      {/* Sidebar desktop */}
      <aside
        className={cx(
          "relative z-30 hidden md:flex flex-col bg-orange-600 text-white transition-all duration-300 ease-in-out",
          isSidebarExpanded ? "w-64" : "w-20"
        )}
      >
        <button
          onClick={() => setIsSidebarExpanded((v) => !v)}
          className="absolute top-4 right-3 rounded p-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Alternar largura da barra lateral"
        >
          {isSidebarExpanded ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo / Título */}
        <div
          className={cx(
            "mt-10 mb-6 px-4 transition-opacity duration-300",
            isSidebarExpanded ? "opacity-100" : "opacity-0"
          )}
        >
          <h1 className="text-2xl font-extrabold tracking-wider">LA MANADA</h1>
          <p className="text-white/80 text-xs mt-1">Painel Administrativo</p>
        </div>

        {/* Navegação */}
        <nav className="flex-1 w-full px-2">
          {navItems.map((item) => (
            <SidebarLink
              key={item.href}
              {...item}
              isExpanded={isSidebarExpanded}
              active={isActive(item.href)}
            />
          ))}
        </nav>

        {/* Footer (Logout) */}
        <div className="w-full px-2 mb-3">
          <SidebarLink
            icon={LogOut}
            text="Sair"
            href="/logout"
            isExpanded={isSidebarExpanded}
            active={false}
          />
        </div>
      </aside>

      {/* Sidebar Mobile (drawer do topo ao rodapé, sem “ficar atrás” de nada) */}
      <div className="md:hidden">
        {/* Topbar mobile fixa com hambúrguer centralizado verticalmente */}
        <div className="fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 h-14 flex items-center justify-between px-4">
          <button
            onClick={() => setIsMobileOpen((v) => !v)}
            className="rounded-md bg-orange-600 p-2 text-white shadow focus:outline-none focus:ring-2 focus:ring-orange-400"
            aria-label="Abrir/fechar menu"
          >
            {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div className="flex items-center">
            <h1 className="text-base font-semibold text-gray-800 tracking-wide">
              LA MANADA
            </h1>
          </div>
          {/* Espaçador simétrico pro layout ficar centralizado visualmente */}
          <div className="w-9" />
        </div>

        {/* Overlay escuro atrás do drawer */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside
          className={cx(
            "fixed inset-y-0 left-0 z-40 h-full w-72 bg-orange-600 text-white shadow-2xl transform transition-transform duration-300 flex flex-col",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-label="Menu lateral"
        >
          {/* Cabeçalho do drawer ocupando topo inteiro */}
          <div className="px-4 h-14 flex items-center justify-between border-b border-white/20">
            <h2 className="text-xl font-extrabold tracking-wider">Menu</h2>
            <button
              onClick={() => setIsMobileOpen(false)}
              className="rounded p-1 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/40"
              aria-label="Fechar menu"
            >
              <X size={22} />
            </button>
          </div>

          {/* Navegação centralizada verticalmente com scroll se precisar */}
          <nav className="flex-1 overflow-y-auto px-2 py-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={cx(
                  "flex items-center p-3 my-1 rounded-lg transition-colors",
                  isActive(item.href)
                    ? "bg-white text-orange-700"
                    : "text-white/90 hover:bg-orange-700 hover:text-white"
                )}
              >
                <item.icon size={22} className="mr-3" />
                <span className="font-medium">{item.text}</span>
              </Link>
            ))}
            <Link
              href="/logout"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center p-3 my-1 rounded-lg text-white/90 hover:bg-orange-700 hover:text-white transition-colors"
            >
              <LogOut size={22} className="mr-3" />
              <span className="font-medium">Sair</span>
            </Link>
          </nav>
        </aside>
      </div>

      {/* Área principal */}
      <div className="flex-1 flex w-full overflow-auto flex-col">
        {/* Header desktop (no mobile o header é a topbar fixa acima) */}
        <header className="hidden md:flex bg-white shadow-sm px-4 md:px-6 py-3 items-center justify-between w-full sticky top-0 z-20">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800">
            Painel de Controle
          </h2>
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-gray-700 font-medium">Bem-vindo(a)!</p>
            </div>
            <div className="relative w-9 h-9 bg-orange-200 rounded-full border border-orange-600 overflow-hidden">
              <Image
                src="/profile.png"
                alt="Foto de Perfil"
                fill
                className="object-cover"
              />
            </div>
          </div>
        </header>

        {/* Empurra o conteúdo pra baixo da topbar no mobile */}
        <div className="md:hidden h-14 shrink-0" />

        {/* Conteúdo: rolagem vertical aqui; mata overflow-x na página */}
        <main className="p-4 md:p-6 flex-1 overflow-y-auto overflow-x-auto">
          {children}
          {/* dica: dentro dos seus cards/tabelas, use overflow-x-auto para tabelas largas */}
        </main>

        {/* Footer: não fixo; aparece após o conteúdo. */}
        <footer className="bg-gray-900 text-white flex md:px-16 px-6 justify-between py-4 text-center shrink-0">
          <p className="text-xs md:text-sm">
            © {new Date().getFullYear()} Las Campanas — Movimento Legendários.
          </p>
          <p className="text-xs md:text-sm">Desenvolvido por — BitBloom AI</p>
        </footer>
      </div>
    </div>
  );
}
