import "./globals.css";
import SupabaseProvider from "../components/SupabaseProvider";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

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
export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <SupabaseProvider>{children}</SupabaseProvider>
      </body>
    </html>
  );
}
