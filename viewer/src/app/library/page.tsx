import type { Metadata } from 'next';
import Link from 'next/link';
import { LibraryDirectory } from '@/components/library/LibraryDirectory';
import { LibraryFigure } from '@/components/library/LibraryFigure';
import { getOrderedLibraryArticles, articleReadingMinutes } from '@/content/library';

const description = 'Explore DNA composition, genome organization, and physical properties through connected explanations and genomic tools.';
export const metadata: Metadata = {
  title: 'Knowledge Library — Polymer', description,
  alternates: { canonical: '/library' },
  openGraph: { title: 'Knowledge Library — Polymer', description, url: '/library' },
  twitter: { card: 'summary_large_image', title: 'Knowledge Library — Polymer', description },
};

export default function LibraryPage() {
  return (
    <div className="platform-shell library-shell">
      <header className="library-intro">
        <p className="platform-eyebrow"><span className="platform-mark" aria-hidden="true" />Knowledge Library / Molecular genomics</p>
        <h1>Understand the material<br className="library-desktop-break" /> of the genome.</h1>
        <p>Composition, organization, and physical behavior. A connected reference for understanding DNA, from chromosomes to individual sequences.</p>
      </header>
      <section className="library-feature" aria-labelledby="library-feature-title">
        <div>
          <p className="platform-eyebrow">The Polymer perspective</p>
          <h2 id="library-feature-title">The material channel<br />of the genome</h2>
          <p>A working framework for connecting what DNA is made of, how it is arranged, and how its properties are studied.</p>
          <Link href="/library/material-channel" className="platform-text-link">Read the perspective <span aria-hidden="true">→</span></Link>
        </div>
        <LibraryFigure kind="scales" />
      </section>
      <LibraryDirectory articles={getOrderedLibraryArticles().map(article => ({
        slug: article.slug, title: article.title, description: article.description,
        kind: article.kind, subjects: article.subjects, collection: article.collection, minutes: articleReadingMinutes(article),
        searchText: [article.title, article.description, ...article.terms, ...article.sections.flatMap(section => [section.title, ...section.paragraphs, section.table?.caption ?? '', ...(section.table?.headings ?? []), ...(section.table?.rows.flat() ?? [])])].join(' ').toLocaleLowerCase(),
      }))} />
      <section className="library-context" aria-labelledby="library-context-title">
        <div><p className="platform-eyebrow">Knowledge ↔ exploration</p><h2 id="library-context-title">Keep the explanation<br />close to the data.</h2><p>Move between reference articles and Polymer’s tools. Relevant links in each article connect concepts to exploration and methods.</p></div>
        <div className="platform-source-links"><Link href="/genomics/atlas">Digital Karyotype <span aria-hidden="true">↗</span></Link><Link href="/genomics">Genome browser &amp; analysis tools <span aria-hidden="true">↗</span></Link><Link href="/genomics/data-sources">Data sources &amp; provenance <span aria-hidden="true">↗</span></Link></div>
      </section>
      <section className="library-editorial" aria-labelledby="library-editorial-title">
        <h2 id="library-editorial-title">About this collection</h2>
        <p>These entries are editorial drafts awaiting scientific review. The collection connects composition and genome organization to DNA mechanics, chromatin maintenance, and the evidence needed to evaluate an explanation. Cellular responses and genomic evolution are planned areas of expansion. The material channel is Polymer’s developing perspective, with established findings distinguished from proposed interpretations.</p>
        <Link href="mailto:polymergenomics@gmail.com?subject=Knowledge%20Library%20feedback">Suggest a correction or a topic <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  );
}
