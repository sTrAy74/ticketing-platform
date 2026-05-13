import type { Metadata } from "next";
import Link from "next/link";
import { Inter } from "next/font/google";
import DemoTimelineBar from "../components/DemoTimelineBar";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Ticketing App",
  description: "Browse events, book tickets, and see live price changes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} min-h-screen bg-stone-100 font-sans text-stone-900 antialiased dark:bg-stone-950 dark:text-stone-100`}>
        <header className="border-b border-stone-200 bg-white/70 backdrop-blur dark:border-stone-800 dark:bg-stone-900/70">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3 text-sm font-medium">
            <Link href="/" className="text-stone-600 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white">
              Home
            </Link>
            <Link href="/events" className="text-stone-600 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white">
              Events
            </Link>
            <Link href="/my-bookings" className="text-stone-600 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white">
              My bookings
            </Link>
            <Link href="/admin" className="text-stone-600 hover:text-stone-950 dark:text-stone-300 dark:hover:text-white">
              Controls
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
        <DemoTimelineBar />
      </body>
    </html>
  );
}
