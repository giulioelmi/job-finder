import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bamboojobs.app"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Bamboo — Your AI Job Search Agent",
    template: "%s | Bamboo",
  },
  description:
    "Bamboo scans 60+ top tech companies on Greenhouse every 20 minutes and emails you when matching jobs appear. Free job alert and application tracking tool.",
  keywords: [
    "job alerts",
    "real-time job notifications",
    "job application tracker",
    "Greenhouse job board monitor",
    "automated job search",
    "tech job alerts",
    "data scientist job alerts",
    "machine learning engineer jobs",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "Bamboo",
    title: "Bamboo — Your AI Job Search Agent",
    description:
      "Get notified within 20 minutes of a new job posting at your target companies. Monitor 60+ top employers on Greenhouse, filter by role and company, and track every application in one dashboard.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Bamboo — Your AI Job Search Agent",
    description:
      "Get notified within 20 minutes of a new job posting at your target companies. Monitor 60+ top employers, filter by keyword, and track applications in one dashboard.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: siteUrl,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
