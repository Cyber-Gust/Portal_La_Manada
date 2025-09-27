// app/comprar-ingresso/layout.js
import '../globals.css';      // reaproveita seu CSS global (se precisa)
import './captura.css';       // CSS específico dessa página

import { Bebas_Neue } from 'next/font/google';

// carrega a fonte desta rota; não interfere no painel
const bebas = Bebas_Neue({ weight: '400', subsets: ['latin'] });

export const metadata = {
  title: 'Manada Las Campanas — Comprar Ingresso',
  description: 'Inscrição e pagamento',
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
