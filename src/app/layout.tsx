import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import PWARegister from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "UPEC Accounting Software", template: "%s | UPEC Accounting" },
  description: "Secure financial management for the University of Port Harcourt Entrepreneurial Centre. Vote Head 520.",
  applicationName: "UPEC Accounting Software",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "UPEC Accounts" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#10284b" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
