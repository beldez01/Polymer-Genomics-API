import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
