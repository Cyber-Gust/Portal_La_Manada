// app/comprar-ingresso/layout.js
import '../globals.css';      // reaproveita seu CSS global (se precisa)
import './captura.css';       // CSS específico dessa página

import { Bebas_Neue } from 'next/font/google';

// carrega a fonte desta rota; não interfere no painel
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'] });

export const metadata = {
  title: "Manada – Check-in do Movimento Legendários",
  description: "Faça seu check-in no evento Manada do Movimento Legendários de forma rápida e segura.",
  icons: {
    icon: "/ico.png", // Favicon
  },
  openGraph: {
    title: "Manada – Check-in do Movimento Legendários",
    description: "Garanta sua entrada no evento Manada do Movimento Legendários. Inscreva-se e participe!",
    url: "https://www.seusite.com/manada", // substitua pelo link real do evento
    siteName: "Movimento Legendários",
    images: [
      {
        url: "/preview.png",
        width: 1200,
        height: 630,
        alt: "Preview do evento Manada",
      },
    ],
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Manada – Check-in do Movimento Legendários",
    description: "Garanta sua entrada no evento Manada do Movimento Legendários. Inscreva-se agora!",
    images: ["/preview.png"],
  },
};

// viewport por metadata (sem <head> manual)
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: 'no',
};

export default function ComprarIngressoLayout({ children }) {
  // aplica a fonte só neste segmento
  return <div className={`${bebas.className} bebas-bold`}>{children}</div>;
}
