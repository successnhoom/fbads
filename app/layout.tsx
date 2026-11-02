import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";

export const metadata: Metadata = {
  title: "AI Ads Expert – Facebook Ads Autopilot",
  description: "ระบบ AI บริหารโฆษณา Facebook/Instagram อัตโนมัติ: หากลุ่มเป้าหมาย ปรับงบ เขียนแอด รายงานผล",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 overflow-x-hidden bg-slate-50 p-4 md:p-8">{children}</main>
        </div>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
