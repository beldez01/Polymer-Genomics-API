import { ImageResponse } from 'next/og';
import { SocialCard } from '@/components/SocialCard';

export const alt = 'Polymer Bio — programmable RNA discovery, genomics, and governed evidence';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <SocialCard
      eyebrow="Biologics · Genomics · Claims"
      title="Polymer Bio"
      description="A functional design foundry for programmable RNA, supported by working genomics and governed-evidence infrastructure."
      badges={['Programmable RNA', 'Working infrastructure']}
    />,
    size,
  );
}
