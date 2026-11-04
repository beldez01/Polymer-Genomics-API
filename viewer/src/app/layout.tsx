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
  title: 'Polymer — Genomics database & API',
  description:
    'Explore reference-genome data, biological annotations, and sequence biophysics through the Polymer genome browser, analysis tools, and API.',
  metadataBase: new URL('https://polymerbio.org'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Polymer — Genomics database & API',
    description:
      'A genomics database and API for exploration, analysis, and programmatic access.',
    url: 'https://polymerbio.org',
    siteName: 'Polymer',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Polymer — Genomics database & API',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polymer — Genomics database & API',
    description:
      'A genomics database and API for exploration, analysis, and programmatic access.',
    images: ['/opengraph-image'],
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
