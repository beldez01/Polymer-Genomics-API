import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

export const metadata = { title: 'UMAP view — Polymer Claims' };

export default function UmapPlaceholder() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: `${SPACE[8]}px ${SPACE[6]}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      <span
        style={{
          color: COLOR.text.muted,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.24em',
          textTransform: 'uppercase',
        }}
      >
        v1 · ships once corpus &gt; 100 claims
      </span>
      <h1
        style={{
          color: COLOR.text.primary,
          fontSize: '2rem',
          fontWeight: WEIGHT.medium,
          margin: `${SPACE[3]}px 0 ${SPACE[4]}px`,
        }}
      >
        UMAP projection
      </h1>
      <p
        style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.7,
          maxWidth: 680,
        }}
      >
        2-D non-linear projection over the 80-dim latent construction for
        claim similarity. Uncertainty halos proportional to evidence class;
        grayscale kernel-density substrate makes gaps legible. Activates once
        the corpus is dense enough that UMAP adds signal beyond PCA.
      </p>
    </main>
  );
}
