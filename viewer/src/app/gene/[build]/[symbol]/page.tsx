'use client';

import { useParams, useRouter } from 'next/navigation';
import { BrandBar } from '@/components/BrandBar';
import { GeneCard } from '@/components/atlas/GeneCard';
import { Footer } from '@/components/Footer';
import { COLOR, FONT_FAMILY } from '@/config/theme';

export default function GenePage() {
  const params = useParams<{ build: string; symbol: string }>();
  const router = useRouter();
  const build  = params.build  ?? 'hg38';
  const symbol = (params.symbol ?? '').toUpperCase();

  return (
    <div
      style={{
        backgroundColor: COLOR.bg.primary,
        minHeight: '100vh',
        fontFamily: FONT_FAMILY,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <BrandBar />

      <div style={{ flex: 1 }}>
        <GeneCard
          symbol={symbol}
          build={build}
          onBack={() => router.back()}
          standalone
        />
      </div>

      <Footer />
    </div>
  );
}
