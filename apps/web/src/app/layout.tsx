import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { getLocale, getDictionary } from "@/lib/i18n/server";
import { LocaleProvider } from "@/lib/i18n/client";
import { SiteFooter } from "@/components/shared/site-footer";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary();
  return {
    title: dict.metadata.title,
    description: dict.metadata.description,
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getLocale();
  const dictionary = getDictionary(locale);
  return (
    <html lang={locale} className={inter.variable}>
      <body className="font-sans">
        <LocaleProvider locale={locale} dictionary={dictionary}>
          <div className="flex min-h-screen flex-col">
            <div className="flex-1">{children}</div>
            <SiteFooter />
          </div>
        </LocaleProvider>
      </body>
    </html>
  );
}
