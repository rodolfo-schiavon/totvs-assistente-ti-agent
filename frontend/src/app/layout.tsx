import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Assistente de TI — TOTVS AI Lab",
  description: "Assistente DevOps/SRE com observabilidade, GitOps e base de runbooks da plataforma",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} antialiased`}>{children}</body>
    </html>
  );
}
