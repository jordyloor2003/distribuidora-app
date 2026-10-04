import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DistriLogix | Distribuidora Mayorista & Sistema Logístico Multicanal",
  description: "Plataforma de distribución comercial mayorista con emisión de pedidos por Email y avisos de despacho por SMS mediante Notify API en AWS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
