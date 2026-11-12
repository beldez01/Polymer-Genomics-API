'use client';

import { useState } from 'react';
import Link from 'next/link';
import { LIBRARY_SUBJECTS } from '@/content/library';
import type { LibraryCollection, SubjectId } from '@/content/library';

export interface LibraryListing {
  slug: string;
  title: string;
  description: string;
  kind: string;
  subjects: SubjectId[];
  collection: LibraryCollection;
  minutes: number;
  searchText: string;
}

export function LibraryDirectory({ articles }: { articles: LibraryListing[] }) {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<SubjectId | 'all'>('all');
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const results = articles.filter(article =>
    (subject === 'all' || article.subjects.includes(subject)) &&
    terms.every(term => article.searchText.includes(term)),
  );
  return (
    <section id="articles" className="library-directory" aria-labelledby="library-articles-title">
      <div className="library-directory-heading">
        <div><p className="platform-eyebrow">The reference collection</p><h2 id="library-articles-title">Find a concept. Follow a connection.</h2></div>
        <div className="library-search">
          <label htmlFor="library-search">Search the library</label>
          <div><input id="library-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Try GC content, CpG, or thermodynamics" autoComplete="off" aria-controls="library-results" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">×</button>}</div>
        </div>
      </div>
      <div className="library-filters" role="group" aria-label="Filter articles by subject">
        <button type="button" aria-pressed={subject === 'all'} onClick={() => setSubject('all')}>All subjects <span>{articles.length}</span></button>
        {LIBRARY_SUBJECTS.map(item => <button key={item.id} type="button" aria-pressed={subject === item.id} onClick={() => setSubject(item.id)}>{item.name}<span>{articles.filter(article => article.subjects.includes(item.id)).length}</span></button>)}
      </div>
      <p className="library-result-count" role="status">{results.length} {results.length === 1 ? 'article' : 'articles'}{subject !== 'all' ? ` · ${LIBRARY_SUBJECTS.find(item => item.id === subject)?.name}` : ''}{query.trim() ? ` matching “${query.trim()}”` : ''}</p>
      <div id="library-results">
        {(['foundations', 'reference'] as const).map(collection => {
          const entries = results.filter(article => article.collection === collection);
          if (entries.length === 0) return null;
          return <section key={collection} className="library-collection" data-collection={collection} aria-labelledby={`library-${collection}-title`}>
            <div className="library-collection-heading"><h3 id={`library-${collection}-title`}>{collection === 'foundations' ? 'Foundations of molecular genomics' : 'Methods & reference'}</h3><span>{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span></div>
            <div className="library-article-grid">{entries.map(article => <ArticleCard key={article.slug} article={article} />)}</div>
          </section>;
        })}
      </div>
      {results.length === 0 && <div className="library-empty"><h3>No matching articles</h3><p>Try a broader term or another subject. This collection covers composition, genome organization, and chromatin maintenance.</p><button type="button" onClick={() => { setQuery(''); setSubject('all'); }}>Reset search and filters</button></div>}
    </section>
  );
}

function ArticleCard({ article }: { article: LibraryListing }) {
  return <Link href={`/library/${article.slug}`} className="library-article-card">
    <div className="library-card-meta"><span>{article.kind}</span><span>{article.minutes} min read</span></div>
    <h4>{article.title}</h4><p>{article.description}</p>
    <div className="library-card-bottom"><span>{article.subjects.map(id => LIBRARY_SUBJECTS.find(item => item.id === id)?.name).join(' / ')}</span><span aria-hidden="true">↗</span></div>
  </Link>;
}
