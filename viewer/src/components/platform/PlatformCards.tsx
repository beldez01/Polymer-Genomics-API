import Link from 'next/link';
import { ViewerThumb, KaryotypeThumb } from './GenomePreviews';
import { VIEWER_HREF, type PlatformTool } from '@/config/platformNavigation';

export function GenomeEntryCards() {
  return (
    <div className="platform-lead-grid">
      <Link href={VIEWER_HREF} className="platform-lead-card">
        <div className="platform-card-top"><span>01 / Region view</span><span aria-hidden>↗</span></div>
        <div className="platform-preview"><ViewerThumb /></div>
        <h3>Genome Browser</h3>
        <p>Explore genes, regions, and genomic data layers — from biological annotations to sequence biophysics.</p>
        <span className="platform-card-action">Open an example region <span aria-hidden>→</span></span>
      </Link>
      <Link href="/genomics/atlas" className="platform-lead-card">
        <div className="platform-card-top"><span>02 / Genome view</span><span aria-hidden>↗</span></div>
        <div className="platform-preview"><KaryotypeThumb /></div>
        <h3>Digital Karyotype</h3>
        <p>Start with the whole genome, explore individual chromosomes, and move into a region of interest.</p>
        <span className="platform-card-action">Explore the karyotype <span aria-hidden>→</span></span>
      </Link>
    </div>
  );
}
export function ToolGrid({ tools }: { tools: PlatformTool[] }) {
  return <div className="platform-tool-grid">{tools.map(tool => (
    <Link className="platform-tool-card" key={tool.href} href={tool.href}>
      <span className="platform-eyebrow">{tool.category}</span>
      <h3>{tool.name}</h3><p>{tool.description}</p>
      <span className="platform-tool-arrow" aria-hidden>↗</span>
    </Link>
  ))}</div>;
}
