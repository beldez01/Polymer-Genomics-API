'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { searchGenes, type SearchResult } from '@/lib/api';
import { parseHomeQuery, SEARCH_ASSEMBLIES, type SearchBuild } from '@/lib/homeSearch';

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [build, setBuild] = useState<SearchBuild>('hg38');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);

  function reset() {
    requestId.current += 1;
    setResults([]); setMessage(''); setBusy(false);
  }

  async function search(event?: FormEvent, example?: string) {
    event?.preventDefault();
    const id = ++requestId.current;
    setResults([]); setMessage(''); setBusy(false);
    if (example) setQuery(example);
    let parsed;
    try { parsed = parseHomeQuery(example ?? query); }
    catch (error) { setMessage((error as Error).message); return; }
    try {
      if (parsed.kind === 'region') {
        router.push(`/genomics/view/${build}/${parsed.region}`);
        return;
      }
      setBusy(true);
      const hits = await searchGenes(parsed.query, build);
      if (id !== requestId.current) return;
      const exact = hits.find(hit => hit.gene_symbol.toUpperCase() === parsed.query);
      if (exact) {
        router.push(`/genomics/gene/${build}/${encodeURIComponent(exact.gene_symbol)}`);
      } else {
        setResults(hits);
        setMessage(hits.length ? `${hits.length} matching genes. Choose a gene below.` : 'No matching genes in this assembly. Try another symbol or assembly; annotation coverage varies.');
      }
    } catch {
      if (id === requestId.current) setMessage('Gene search is unavailable. Please try again.');
    } finally {
      if (id === requestId.current) setBusy(false);
    }
  }

  return <div className="platform-home-search">
    <form onSubmit={search} role="search" aria-label="Search the genome">
      <div className="platform-search-fields">
        <div className="platform-query-field"><label htmlFor="home-query">Gene or genomic interval</label>
          <input id="home-query" value={query} onChange={e => { reset(); setQuery(e.target.value); }} placeholder="TP53 or chr17:7,668,421-7,687,490" maxLength={100} autoComplete="off" spellCheck={false} aria-describedby="home-search-help home-search-status" />
        </div>
        <div className="platform-assembly-field"><label htmlFor="home-assembly">Assembly</label>
          <select id="home-assembly" value={build} onChange={e => { reset(); setBuild(e.target.value as SearchBuild); }}>
            {SEARCH_ASSEMBLIES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
          </select>
        </div>
        <button className="platform-button" type="submit" disabled={busy}>{busy ? 'Searching…' : 'Search →'}</button>
      </div>
      <p id="home-search-help">Coordinates are 1-based, inclusive, in the selected assembly. Layer coverage varies by assembly.</p>
      <div className="platform-search-examples"><span>Try</span>{['TP53', 'BRCA1', 'chr17:7,668,421-7,687,490'].map(example => <button type="button" key={example} onClick={() => search(undefined, example)}>{example}</button>)}</div>
      <p id="home-search-status" role="status" aria-live="polite">{message}</p>
    </form>
    {results.length > 0 && <ul className="platform-search-results" aria-label="Matching genes">{results.map(hit => <li key={hit.gene_symbol}><Link href={`/genomics/gene/${build}/${encodeURIComponent(hit.gene_symbol)}`}><strong>{hit.gene_symbol}</strong><span>{hit.matched_alias ? `Alias: ${hit.matched_alias} · ` : ''}{hit.chromosome}</span></Link></li>)}</ul>}
  </div>;
}
