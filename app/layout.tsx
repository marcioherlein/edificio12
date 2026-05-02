import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Edificio 12",
  description: "Gestión de expensas y pagos del edificio",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="h-full bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
