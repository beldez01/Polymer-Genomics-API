import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Polymer Genomics — Curated Genomic Reference Data',
  description:
    'Interactive genome browser and REST API for curated genomic annotations. Query genes, CpG sites, methylation probes, and isochores at base-pair resolution.',
  metadataBase: new URL('https://polymerbio.org'),
  openGraph: {
    title: 'Polymer Genomics',
    description:
      'Curated genomic reference data at base-pair resolution. Interactive browser and REST API for genes, CpG sites, probes, and isochores.',
    url: 'https://polymerbio.org',
    siteName: 'Polymer Genomics',
    type: 'website',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Polymer Genomics',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Polymer Genomics',
    description:
      'Curated genomic reference data at base-pair resolution.',
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
