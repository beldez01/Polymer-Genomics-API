import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8"
          style={{ backgroundColor: '#0A0A0A' }}>
      <h1 style={{
        fontSize: '2.25rem',
        fontWeight: 700,
        letterSpacing: '-0.025em',
        marginBottom: 16,
        color: '#4ECDC4',
        fontFamily: "'JetBrains Mono', monospace",
      }}>
        Polymer Genomics
      </h1>
      <p style={{
        color: '#666',
        marginBottom: 32,
        textAlign: 'center',
        maxWidth: 480,
        fontSize: 13,
        fontFamily: "'JetBrains Mono', monospace",
        lineHeight: 1.6,
      }}>
        Interactive genome browser for curated genomic reference data.
        Navigate to any region at base-pair resolution.
      </p>
      <Link
        href="/view/hg38/chr16:70699930-70700000"
        style={{
          padding: '10px 24px',
          backgroundColor: '#111111',
          color: '#4ECDC4',
          border: '1px solid #1a1a1a',
          fontWeight: 500,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          textDecoration: 'none',
          transition: 'background-color 0.15s',
        }}
      >
        Open Viewer &rarr; VAC14 (chr16)
      </Link>
    </main>
  );
}
