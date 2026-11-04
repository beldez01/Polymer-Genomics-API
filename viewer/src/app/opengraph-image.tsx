import { ImageResponse } from 'next/og';
import { SocialCard } from '@/components/SocialCard';

export const alt = 'Polymer — Genomics database & API';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <SocialCard
      eyebrow="Explore · Analyze · Build"
      title="Polymer"
      description="A genomics database and API. Explore reference-genome data, biological annotations, and sequence biophysics."
      badges={['Genome exploration', 'Data & API']}
    />,
    size,
  );
}
