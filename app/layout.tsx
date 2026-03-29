import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/presentation/components/ui/ToastContainer";

export const metadata: Metadata = {
  title: "AI Split — Smart Bill Splitter",
  description: "Split bills intelligently with item-level and quantity-level assignments",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Split",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 dark:bg-slate-900" suppressHydrationWarning>
        <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2">
            <span className="text-2xl">🧾</span>
            <span className="font-bold text-lg text-slate-800 dark:text-slate-100">
              AI Split
            </span>
            <span className="text-slate-400 text-sm ml-1">Smart Bill Splitter</span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
        <ToastContainer />
      </body>
    </html>
  );
}
