import Link from 'next/link';

export default function ArticleNotFound() {
  return <div className="platform-shell library-empty"><h1>Article not found</h1><p>This article is not in the current collection.</p><Link className="platform-text-link" href="/library">Browse the Knowledge Library →</Link></div>;
}
