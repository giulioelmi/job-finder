import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VacanSea - Job Alert Dashboard",
  description: "Get notified about new job postings every 30 minutes",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
