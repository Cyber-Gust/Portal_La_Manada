// components/DashboardLayout.jsx
"use client";

import Image from 'next/image';
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useSessionContext } from "@supabase/auth-helpers-react";
import { usePathname, useRouter } from "next/navigation";
import SignOutButton from './SignOutButton';
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
      {!isExpanded && (
        <span
          className="pointer-events-none absolute left-16 z-10 opacity-0 group-hover:opacity-100
                     bg-black/80 text-white text-xs rounded px-2 py-1 translate-y-[-2px]"
          role="tooltip"
        >
          {text}
        </span>
      )}
    </Link>
  );
};

export default function DashboardLayout({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isLoading, session } = useSessionContext();

  // estados
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // ✅ MOVIDO PARA CIMA DOS RETURNS (ordem estável de hooks)
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

  // Gatekeeper de sessão (client)
  useEffect(() => {
    if (isLoading) return;
    if (!session)
      router.replace(
        `/login?redirectTo=${encodeURIComponent(pathname || "/dashboard")}`
      );
  }, [isLoading, session, pathname, router]);

  // early-returns OK, todos hooks já foram declarados acima
  if (isLoading) return <div className="min-h-screen bg-gray-50" />;
  if (!session) return null;

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar desktop */}
      <aside
        className={cx(
          "relative z-30 flex flex-col bg-orange-600 text-white transition-all duration-300 ease-in-out",
          isSidebarExpanded ? "w-64" : "w-20",
          "hidden md:flex"
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

      {/* Sidebar Mobile */}
      <div className="md:hidden">
        <button
          onClick={() => setIsMobileOpen((v) => !v)}
          className="fixed top-4 left-4 z-40 rounded-md bg-orange-600 p-2 text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-white/40"
          aria-label="Abrir/fechar menu"
        >
          {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {isMobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/40"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        <aside
          className={cx(
            "fixed top-0 left-0 z-40 h-full w-72 bg-orange-600 text-white shadow-2xl transform transition-transform duration-300",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="px-4 py-5">
            <h1 className="text-2xl font-extrabold tracking-wider">LA MANADA</h1>
          </div>
          <nav className="px-2">
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
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-white shadow-sm px-4 md:px-6 py-3 flex items-center justify-between w-full">
          <h2 className="text-lg md:text-xl font-semibold text-gray-800">
            Painel de Controle
          </h2>
          <div className="flex items-center space-x-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm text-gray-700 font-medium">Bem-vindo(a)!</p>
            </div>
            <div className="relative w-9 h-9 bg-orange-200 rounded-full border border-orange-600 overflow-hidden">
      {/* A imagem será posicionada de forma absoluta para preencher o div pai.
        'object-cover' garante que a imagem preencha o container sem distorção, 
        cortando as bordas se necessário.
        'fill' (com next/image) ou 'w-full h-full' (com img normal) garantem que ela ocupe todo o espaço.
      */}
      <Image
        src="/profile.png" // Caminho relativo à pasta `public`
        alt="Foto de Perfil"
        fill // Preenche o elemento pai com 'position: absolute'
        className="object-cover"
      />
      {/* Ou, se não quiser usar next/image: */}
      {/*
      <img
        src="/profile.jpg" // Caminho relativo à pasta `public`
        alt="Foto de Perfil"
        className="absolute inset-0 w-full h-full object-cover"
      />
      */}
    </div>
          </div>
        </header>

        {/* Conteúdo */}
        <main className="p-4 md:p-6 flex-1 overflow-y-auto">{children}</main>

        {/* Footer */}
        <footer className="bg-gray-900 text-white flex md:px-16 px-16 justify-between py-4 text-center">
          <p className="text-xs md:text-sm">
            © {new Date().getFullYear()} Las Camopanas — Movimento Legendários. 
          </p><p className="text-xs md:text-sm">
             Desenvolvido por - BitBloom AI
          </p>
        </footer>
      </div>
    </div>
  );
}
