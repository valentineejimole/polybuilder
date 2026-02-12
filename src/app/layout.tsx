import type { Metadata } from "next";
import Link from "next/link";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Polymarket Builder-Routed Trades Dashboard",
  description: "Dashboard for authenticated builder-routed CLOB trades",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} antialiased`}>
        <div className="min-h-screen bg-slate-950 text-slate-100">
          <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between px-4 py-4">
              <p className="text-sm font-semibold tracking-wide">Polymarket Builder Dashboard</p>
              <nav className="flex items-center gap-2 text-sm">
                <Link href="/dashboard" className="rounded px-3 py-2 text-slate-200 hover:bg-slate-800">
                  Dashboard
                </Link>
                <Link href="/settings" className="rounded px-3 py-2 text-slate-200 hover:bg-slate-800">
                  Settings
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
