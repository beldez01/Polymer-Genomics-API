import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

export const metadata = { title: 'Pathway view — Polymer Claims' };

export default function PathwayPlaceholder() {
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
        v1 · ships with ≥20 pathway claims
      </span>
      <h1
        style={{
          color: COLOR.text.primary,
          fontSize: '2rem',
          fontWeight: WEIGHT.medium,
          margin: `${SPACE[3]}px 0 ${SPACE[4]}px`,
        }}
      >
        Pathway view
      </h1>
      <p
        style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.7,
          maxWidth: 680,
        }}
      >
        Reactome / KEGG / WikiPathways substrate via <code>cytoscape.js</code>.
        Claims sit on the pathway nodes they make statements about; hot
        nodes (touched by many claims) get an orange corona. Activates once
        enough pathway-subject claims are authored.
      </p>
    </main>
  );
}
