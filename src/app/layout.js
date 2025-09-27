import "./globals.css";
import SupabaseProvider from "../components/SupabaseProvider";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "La Manada - Check-in System",
  description: "Plataforma de Check-in para o evento La Manada.",
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
