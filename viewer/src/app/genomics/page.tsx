import type { Metadata } from 'next';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { GenomeEntryCards, ToolGrid } from '@/components/platform/PlatformCards';
import { ANALYSIS_TOOLS, RESOURCE_TOOLS } from '@/config/platformNavigation';
export const metadata: Metadata = {
  title: 'Genomic tools & resources — Polymer',
  description: 'Explore the Polymer genome browser, digital karyotype, analysis tools, and API resources.',
  alternates: { canonical: '/genomics' },
  openGraph: { title: 'Genomic tools & resources — Polymer', url: '/genomics', description: 'Explore genomic data, analysis tools, and programmatic access.' },
};
export default function GenomicsIndex() {
  return (
    <main className="platform-page">
      <BrandBar sticky />
      <header className="platform-shell platform-intro"><p className="platform-eyebrow">The tool directory</p><h1>Genomic tools &amp; resources.</h1><p className="platform-deck">Explore reference-genome data, investigate a sequence, or connect your own workflow. Choose a tool to get started.</p></header>
      <section aria-labelledby="explore-heading" className="platform-shell platform-explore"><div className="platform-section-heading"><h2 id="explore-heading">Genome exploration</h2></div><GenomeEntryCards /></section>
      <section aria-labelledby="analysis-heading" className="platform-shell platform-section"><div className="platform-section-heading"><h2 id="analysis-heading">Analysis &amp; design</h2></div><ToolGrid tools={ANALYSIS_TOOLS} /></section>
      <section aria-labelledby="resources-heading" className="platform-shell platform-section"><div className="platform-section-heading"><h2 id="resources-heading">Knowledge, data &amp; developer resources</h2></div><ToolGrid tools={RESOURCE_TOOLS} /></section>
      <Footer />
    </main>
  );
}
