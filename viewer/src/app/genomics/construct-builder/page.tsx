import type { Metadata } from 'next';
import { BrandBar } from '@/components/BrandBar';
import { ConstructStudio } from '@/construct-studio/ConstructStudio';

export const metadata: Metadata = {
  title: 'RNA Construct Builder — Polymer Bio',
  description:
    'A direct-manipulation workspace for programmable-RNA constructs: strands and duplexes as first-class objects, nearest-neighbour thermodynamics, complementarity search and sourced design lint.',
};

/**
 * A full-height application surface rather than a document, so it carries the
 * brand bar for navigation but no footer — the studio owns the rest of the
 * viewport, and flex sizing avoids hard-coding the header height.
 */
export default function ConstructBuilderPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <BrandBar subtitle="RNA Construct Builder" />
      <main style={{ flex: 1, minHeight: 0 }}>
        <ConstructStudio />
      </main>
    </div>
  );
}
