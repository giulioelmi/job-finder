import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "VacanSea — Automated Job Alerts for Tech Roles",
    template: "%s | VacanSea",
  },
  description:
    "VacanSea scans 60+ top tech companies on Greenhouse every 30 minutes and emails you when matching jobs appear. Free job alert and application tracking tool.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
