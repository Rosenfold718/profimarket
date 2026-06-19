import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["500", "600", "700", "800"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#1a1a2e',
};

export const metadata: Metadata = {
  title: "ProfiMarket — Маркетплейс профессионалов",
  description: "Единая платформа для поиска проверенных сметчиков, экспертов, юристов, проектировщиков и кадастровых инженеров. Для судов, бюджетных организаций и бизнеса.",
  keywords: ["экспертиза", "сметчик", "юрист", "проектировщик", "кадастр", "маркетплейс", "специалисты"],
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect rx='20' width='100' height='100' fill='%231a1a2e'/><text x='50' y='68' font-size='55' text-anchor='middle' fill='white'>P</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${jakarta.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
