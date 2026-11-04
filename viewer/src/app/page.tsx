import type { Metadata } from 'next';
import Link from 'next/link';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { GenomeEntryCards, ToolGrid } from '@/components/platform/PlatformCards';
import { ANALYSIS_TOOLS } from '@/config/platformNavigation';

const description = 'A genomics database and API for exploring reference-genome data, biological annotations, and sequence biophysics.';
export const metadata: Metadata = {
  title: 'Polymer — Genomics database & API', description,
  alternates: { canonical: '/' },
  openGraph: { title: 'Polymer — Genomics database & API', description, url: '/', siteName: 'Polymer' },
  twitter: { card: 'summary_large_image', title: 'Polymer — Genomics database & API', description },
};
export default function Home() {
  return (
    <main className="platform-page">
      <BrandBar sticky />
      <header className="platform-shell platform-intro">
        <p className="platform-eyebrow"><span className="platform-mark" aria-hidden />Genomics database &amp; API</p>
        <h1>Explore the Genome</h1>
        <p className="platform-deck">Reference-genome data, biological annotations, and sequence biophysics. Connected tools for exploration, analysis, and programmatic access.</p>
      </header>
      <section id="explore" aria-labelledby="explore-title" className="platform-shell platform-explore">
        <div className="platform-section-heading"><h2 id="explore-title">Two ways into the genome</h2><span className="platform-eyebrow">Explore / 01</span></div>
        <GenomeEntryCards />
      </section>
      <section aria-labelledby="api-title" className="platform-shell platform-section">
        <div className="platform-api-panel">
          <div>
            <p className="platform-eyebrow">Build / 02</p>
            <h2 id="api-title">Genomic data.<br />In your workflow.</h2>
            <p>Bring reference data and analysis into your own research. Use the REST API directly, work in Python, or connect an AI agent through MCP.</p>
            <div className="platform-button-row"><Link className="platform-button" href="/genomics/developers">Developer quickstart <span aria-hidden>↗</span></Link><Link className="platform-text-link" href="/genomics/docs">API documentation <span aria-hidden>→</span></Link></div>
          </div>
          <div className="platform-access-list">
            <div><span>01</span><div><h3>REST API</h3><p>Query genomic data from your applications.</p></div></div>
            <div><span>02</span><div><h3>Python SDK</h3><p>Work with Polymer in scripts and notebooks.</p></div></div>
            <div><span>03</span><div><h3>MCP</h3><p>Connect compatible agents to genomic tools.</p></div></div>
          </div>
        </div>
      </section>
      <section aria-labelledby="tools-title" className="platform-shell platform-section">
        <div className="platform-section-heading"><div><p className="platform-eyebrow">Analyze / 03</p><h2 id="tools-title">Tools for the next question</h2></div><Link className="platform-text-link" href="/genomics">View all genomic tools <span aria-hidden>→</span></Link></div>
        <ToolGrid tools={ANALYSIS_TOOLS} />
      </section>
      <section aria-labelledby="sources-title" className="platform-shell platform-section platform-sources">
        <div><p className="platform-eyebrow">Understand / 04</p><h2 id="sources-title">Know the data behind the view.</h2><p>Explore the sources and methods behind Polymer, with provenance and license information for genomic data layers.</p></div>
        <div className="platform-source-links"><Link href="/genomics/data-sources">Browse data sources <span aria-hidden>↗</span></Link><Link href="/genomics/docs/methodology">Read the methodology <span aria-hidden>↗</span></Link></div>
      </section>
      <Footer />
    </main>
  );
}
