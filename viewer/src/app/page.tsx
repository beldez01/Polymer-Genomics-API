import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold tracking-tight mb-4">
        Polymer Genomics
      </h1>
      <p className="text-gray-400 mb-8 text-center max-w-lg">
        Interactive genome browser for curated genomic reference data.
        Navigate to any region at base-pair resolution.
      </p>
      <Link
        href="/view/hg38/chr16:70699930-70700000"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium transition-colors"
      >
        Open Viewer &rarr; VAC14 (chr16)
      </Link>
    </main>
  );
}
