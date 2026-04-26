import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

export const metadata = { title: 'Cohort view — Polymer Claims' };

export default function CohortPlaceholder() {
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
        v1 · ships with ≥20 clinical claims
      </span>
      <h1
        style={{
          color: COLOR.text.primary,
          fontSize: '2rem',
          fontWeight: WEIGHT.medium,
          margin: `${SPACE[3]}px 0 ${SPACE[4]}px`,
        }}
      >
        Cohort view
      </h1>
      <p
        style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.7,
          maxWidth: 680,
        }}
      >
        Sankey layout for cohort-level and clinical claims: columns of
        (source dataset → inclusion criteria → exposure strata → outcome).
        Each claim is a ribbon whose width is the cohort N. Activates once
        the corpus has enough phenopacket-shaped subjects to be non-empty.
      </p>
    </main>
  );
}
