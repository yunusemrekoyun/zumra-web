import type { Metadata } from 'next';
import { Playfair_Display, Manrope } from 'next/font/google';
import './globals.css';

// Using Playfair Display as a fallback for Rosmatika (elegant serif)
const rosmatikaFallback = Playfair_Display({ subsets: ['latin'], variable: '--font-rosmatika' });
// Using Manrope as a fallback for Neubau Pro (clean modern sans)
const neubauFallback = Manrope({ subsets: ['latin'], variable: '--font-neubau' });

export const metadata: Metadata = {
  title: 'Zümra Akademi | Kadınlara Özel Online Dil Eğitimi',
  description: 'Zümra Akademi, kadınlara özel online dil eğitimiyle güvenli, nitelikli ve tamamen online bir öğrenme deneyimi sunar.',
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="tr" className={`${rosmatikaFallback.variable} ${neubauFallback.variable}`}>
      <body className="antialiased selection:bg-brand-primary selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
