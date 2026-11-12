import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LibraryFigure } from '@/components/library/LibraryFigure';
import { LIBRARY_ARTICLES, LIBRARY_SUBJECTS, getLibraryArticle, articleReadingMinutes } from '@/content/library';

export function generateStaticParams() {
  return LIBRARY_ARTICLES.map(article => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const article = getLibraryArticle((await params).slug);
  if (!article) return { title: 'Article not found — Polymer' };
  const title = `${article.title} — Polymer Knowledge Library`;
  return {
    title, description: article.description, alternates: { canonical: `/library/${article.slug}` },
    openGraph: { title, description: article.description, url: `/library/${article.slug}`, type: 'article', modifiedTime: article.updated },
    twitter: { card: 'summary_large_image', title, description: article.description },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const article = getLibraryArticle((await params).slug);
  if (!article) notFound();
  const related = article.related.map(getLibraryArticle).filter(item => item !== undefined);
  return (
    <div className="platform-shell library-shell">
      <nav className="library-breadcrumb" aria-label="Breadcrumb"><Link href="/library">Knowledge Library</Link><span aria-hidden="true">/</span><span>{article.kind}</span></nav>
      <header className="library-article-header">
        <p className="platform-eyebrow">{article.subjects.map(id => LIBRARY_SUBJECTS.find(subject => subject.id === id)?.name).join(' / ')}</p>
        <h1>{article.title}</h1><p className="library-article-deck">{article.description}</p>
        <div className="library-article-meta"><span>Polymer · {article.status}</span><span>{articleReadingMinutes(article)} min read</span><span>Updated <time dateTime={article.updated}>{new Date(`${article.updated}T00:00:00Z`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}</time></span></div>
      </header>
      <div className="library-reading-layout">
        <aside className="library-contents">
          <nav aria-label="On this page"><p className="platform-eyebrow">On this page</p>{article.sections.map(section => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}<a href="#article-connections">Connections &amp; tools</a>{article.references.length > 0 && <a href="#article-references">References</a>}</nav>
          <p className="library-review-note">Scientific review pending.{article.kind === 'Perspective' ? ' This article describes Polymer’s developing editorial framework.' : ' Interpretations and wording may change through review.'}</p>
        </aside>
        <article className="library-article" aria-label={article.title}>
          {article.figure && <LibraryFigure kind={article.figure} />}
          {article.sections.map(section => <section key={section.id} id={section.id} className="library-prose-section">
            <h2>{section.title}</h2>{section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
            {section.figure && <LibraryFigure kind={section.figure} />}
            {section.table && <div className="library-table-scroll" role="region" aria-label={section.table.caption} tabIndex={0}>
              <table className="library-table"><caption>{section.table.caption}</caption>
                <thead><tr>{section.table.headings.map(heading => <th key={heading} scope="col">{heading}</th>)}</tr></thead>
                <tbody>{section.table.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th key={cellIndex} scope="row">{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>}
            {section.sourceIds && <p className="library-section-sources">Sources: {section.sourceIds.map(id => {
              const index = article.references.findIndex(reference => reference.id === id);
              return <a key={id} href={`#reference-${id}`} title={article.references[index]?.citation} aria-label={`Reference ${index + 1}: ${article.references[index]?.citation}`}>[{index + 1}]</a>;
            })}</p>}
          </section>)}
          <section id="article-connections" className="library-connections">
            <h2>Connections &amp; tools</h2>
            <h3>Related reading</h3>
            <div className="library-related-links">{related.map(item => <Link href={`/library/${item.slug}`} key={item.slug}>{item.title}<span aria-hidden="true">→</span></Link>)}</div>
            <h3>Explore in Polymer</h3>
            <div className="library-tool-links">{article.tools.map(tool => <Link key={tool.href} href={tool.href}><strong>{tool.title} <span aria-hidden="true">↗</span></strong><span>{tool.description}</span></Link>)}</div>
          </section>
          {article.references.length > 0 && <section id="article-references" className="library-references"><h2>References</h2><ol>{article.references.map(reference => <li key={reference.id} id={`reference-${reference.id}`}><a href={reference.href}>{reference.title} <span aria-hidden="true">↗</span></a><span>{reference.citation}</span></li>)}</ol></section>}
          <div className="library-article-end"><Link href="/library">← Back to the library</Link><a href={`mailto:polymergenomics@gmail.com?subject=${encodeURIComponent(`Library correction: ${article.title}`)}`}>Suggest a correction ↗</a></div>
        </article>
      </div>
    </div>
  );
}
