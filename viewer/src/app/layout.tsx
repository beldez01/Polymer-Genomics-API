import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

// next/font/google self-hosts the optimized fonts and exposes them as
// CSS variables on the element we apply .variable to. Body and any
// component using var(--font-inter) / var(--font-jetbrains-mono) reads
// the optimized family name automatically.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
  weight: ['400', '500', '700'],
});

export const metadata: Metadata = {
  title: 'Polymer Genomics — Genome-wide DNA biophysics',
  description:
    'The material channel of the genome — stacking energy, curvature, flexibility, groove geometry — computed at base-pair resolution across 50 genomic layers. REST API and MCP tools for AI agents.',
  metadataBase: new URL('https://polymerbio.org'),
  openGraph: {
    title: 'Polymer Genomics — Genome-wide DNA biophysics',
    description:
      'Stacking energy, curvature, flexibility, groove geometry — computed at base-pair resolution across 50 genomic layers. Queryable by humans and by agents.',
    url: 'https://polymerbio.org',
    siteName: 'Polymer Genomics',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Polymer Genomics — the material channel of the genome',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polymer Genomics — Genome-wide DNA biophysics',
    description:
      'The material channel of the genome, computed at base-pair resolution across 50 layers.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
