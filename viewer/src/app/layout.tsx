import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Polymer Genomics Viewer',
  description: 'Interactive genome browser for curated genomic reference data',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
