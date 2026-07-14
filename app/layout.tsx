import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SmoothScroll from "@/components/SmoothScroll";
import "./globals.css";

const display = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const TITLE = "Kağan Tav — Full Stack Web & Mobil Developer";
const DESCRIPTION =
  "Ankara merkezli Full Stack Web & Mobil Developer. React, Next.js, PHP, C#/.NET, SQL ve Supabase ile kurumsal web siteleri, yönetim panelleri ve mobil uygulamalar. 2+ yıl, 50+ teslim edilmiş proje.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Kağan Tav",
  authors: [{ name: "Kağan Tav" }],
  creator: "Kağan Tav",
  keywords: [
    "Kağan Tav",
    "Full Stack Developer",
    "Web Developer",
    "Mobil Developer",
    "Yazılım Geliştirici",
    "React",
    "Next.js",
    "PHP",
    "C#",
    ".NET",
    "SQL",
    "Supabase",
    "React Native",
    "Ankara",
    "Portföy",
  ],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "tr_TR",
    url: "/",
    siteName: "Kağan Tav",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body className={`${display.variable} ${body.variable}`}>
        <SmoothScroll>{children}</SmoothScroll>
        {/* Vercel Analytics — ziyaret sayısı, ülke, referrer, cihaz.
            (Kişi kimliği DEĞİL; bkz. gizlilik notu.) */}
        <Analytics />
      </body>
    </html>
  );
}
