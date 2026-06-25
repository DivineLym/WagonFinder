import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';

const inter = Inter({ subsets: ['latin', 'cyrillic'] });

export const metadata: Metadata = {
  title: 'WagonFinder — Логистика КТЖ',
  description: 'Платформа для грузоотправителей и собственников вагонов',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  let locale = 'ru';
  let messages: Record<string, unknown> = {};
  try {
    locale = await getLocale();
    messages = await getMessages() as Record<string, unknown>;
  } catch {
    // fallback to Russian if i18n fails (e.g., missing cookie on first load)
    messages = (await import('../messages/ru.json')).default as Record<string, unknown>;
  }

  return (
    <html lang={locale} className="h-full">
      <body className={`${inter.className} min-h-full antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
