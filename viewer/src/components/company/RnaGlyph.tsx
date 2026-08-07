/* ────────────────────────────────────────────────────────────────────────
   The hero glyph — the calligraphic RNA figure, served as artwork.

   public/hero-glyph.png is the source drawing, cropped to its ink with a few
   stray specks removed. It is black on transparent, so color is applied
   here: feColorMatrix rewrites RGB to a flat tone and keeps the alpha, which
   lets the one asset paint white on the blue field and electric blue on the
   off-white below.

   The color change is geometry, not a gradient. Two copies are rendered: one
   inside the blue hero, one inside the band under it. Each parent clips with
   overflow:hidden, and both are offset so SEAM_Y lands exactly on the shared
   edge — the figure reads as a single mark that changes color as it leaves
   the blue. SEAM_Y sits on the long S, at a height the drawing crosses
   exactly once.

   Keep SEAM_Y / GLYPH_H in step with --glyph-seam / --glyph-h in
   globals.css; those place the two copies against the seam.
   ──────────────────────────────────────────────────────────────────────── */

export const GLYPH_W = 451;
export const GLYPH_H = 1046;
export const SEAM_Y = 783;

const TINT: Record<'onBlue' | 'onLight', [number, number, number]> = {
  onBlue: [1, 1, 1],
  onLight: [0.0588, 0.3843, 0.9961],
};

export function RnaGlyph({ tone }: { tone: 'onBlue' | 'onLight' }) {
  const [r, g, b] = TINT[tone];
  const tintId = `rna-tint-${tone}`;
  return (
    <svg
      viewBox={`0 0 ${GLYPH_W} ${GLYPH_H}`}
      aria-hidden
      focusable="false"
      style={{ display: 'block' }}
    >
      <defs>
        {/* Flatten RGB to the tone, keep alpha. sRGB so the blue stays exact. */}
        <filter id={tintId} colorInterpolationFilters="sRGB">
          <feColorMatrix
            type="matrix"
            values={`0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 1 0`}
          />
        </filter>
      </defs>
      <image
        href="/hero-glyph.png"
        x={0}
        y={0}
        width={GLYPH_W}
        height={GLYPH_H}
        filter={`url(#${tintId})`}
      />
    </svg>
  );
}
