'use client';

import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, FONT_FAMILY, FONT_FAMILY_SANS, TYPE, WEIGHT, SPACE } from '@/config/theme';

const section = {
  marginBottom: SPACE[6],
};

const h2Style = {
  ...TYPE.lg,
  fontWeight: WEIGHT.bold,
  fontFamily: FONT_FAMILY,
  color: COLOR.text.primary,
  marginBottom: SPACE[3],
  marginTop: SPACE[5],
  borderBottom: `1px solid ${COLOR.border.subtle}`,
  paddingBottom: SPACE[2],
};

const h3Style = {
  ...TYPE.base,
  fontWeight: WEIGHT.medium,
  fontFamily: FONT_FAMILY,
  color: COLOR.text.primary,
  marginBottom: SPACE[2],
  marginTop: SPACE[4],
};

const pStyle = {
  fontSize: 15,
  fontFamily: FONT_FAMILY_SANS,
  color: COLOR.text.secondary,
  lineHeight: 1.6,
  letterSpacing: 0,
  marginBottom: SPACE[3],
  maxWidth: 720,
};

const tableStyle: React.CSSProperties = {
  ...TYPE.xs,
  fontFamily: FONT_FAMILY,
  borderCollapse: 'collapse' as const,
  width: '100%',
  maxWidth: 780,
  marginBottom: SPACE[4],
};

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  borderBottom: `2px solid ${COLOR.border.subtle}`,
  color: COLOR.text.faint,
  fontWeight: WEIGHT.medium,
  ...TYPE.xs,
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: `1px solid ${COLOR.border.subtle}22`,
  color: COLOR.text.secondary,
};

export default function MethodologyPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: COLOR.bg.primary }}>
      <BrandBar />
      <main style={{ flex: 1, maxWidth: 860, margin: '0 auto', padding: `${SPACE[6]}px ${SPACE[4]}px` }}>

        <h1 style={{ ...TYPE.xl, fontWeight: WEIGHT.bold, fontFamily: FONT_FAMILY, color: COLOR.text.primary, marginBottom: SPACE[2] }}>
          Biophysics Methodology
        </h1>
        <p style={{ ...pStyle, color: COLOR.text.faint, marginBottom: SPACE[5] }}>
          How DNA biophysical properties are computed, what they mean, and what they don&apos;t.
        </p>

        {/* ── What We Compute ── */}
        <div style={section}>
          <h2 style={h2Style}>What We Compute</h2>
          <p style={pStyle}>
            The API computes intrinsic biophysical properties of DNA sequence using published
            nearest-neighbor parameter tables. These are <strong>sequence-derived predictions</strong> for
            naked B-form DNA in standard buffer conditions (37°C, 1 M NaCl). They describe what
            the sequence <em>would</em> do in isolation, not what it does in a living cell.
          </p>
          <p style={pStyle}>
            In vivo, proteins, chromatin, supercoiling, and ionic conditions all modify DNA
            behavior. Our values represent the intrinsic baseline — the starting point before
            biology acts.
          </p>

          <h3 style={h3Style}>Parameter Sources</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Property</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Method</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>Stacking ΔG₃₇, ΔH, ΔS</td><td style={tdStyle}>SantaLucia 1998</td><td style={tdStyle}>Calorimetric melting of oligonucleotides</td></tr>
              <tr><td style={tdStyle}>Roll, tilt, twist, rise, slide, shift</td><td style={tdStyle}>Olson et al. 2001</td><td style={tdStyle}>Protein–DNA crystal structure survey</td></tr>
              <tr><td style={tdStyle}>Deformability (TRX)</td><td style={tdStyle}>Heddi et al. 2010</td><td style={tdStyle}>NMR ³¹P chemical shifts (BII backbone)</td></tr>
              <tr><td style={tdStyle}>Z-form propensity</td><td style={tdStyle}>Ho 1986 / Z-Hunt</td><td style={tdStyle}>B→Z transition energetics</td></tr>
              <tr><td style={tdStyle}>A-form propensity</td><td style={tdStyle}>El Hassan & Calladine 1996</td><td style={tdStyle}>Crystal structure statistics</td></tr>
              <tr><td style={tdStyle}>Groove geometry</td><td style={tdStyle}>El Hassan & Calladine 1997</td><td style={tdStyle}>Crystal structure measurements</td></tr>
              <tr><td style={tdStyle}>Extinction ε₂₆₀</td><td style={tdStyle}>Tataurov et al. 2008</td><td style={tdStyle}>Nearest-neighbor UV absorbance</td></tr>
              <tr><td style={tdStyle}>Curvature</td><td style={tdStyle}>Trifonov/Bolshoy 1991</td><td style={tdStyle}>Trajectory-integrated wedge model</td></tr>
            </tbody>
          </table>
          <p style={{ ...pStyle, ...TYPE.xs, color: COLOR.text.faint }}>
            All 48 nearest-neighbor thermodynamic parameters have been verified exact-match against
            the original publications (validated 2026-04-06, Tier 1).
          </p>
        </div>

        {/* ── GC and Arrangement ── */}
        <div style={section}>
          <h2 style={h2Style}>GC Content and Arrangement Capacity</h2>
          <p style={pStyle}>
            At 1 kb resolution, many biophysical properties correlate strongly with GC content.
            Stacking ΔG₃₇ correlates r = −0.997 with GC; Z-form propensity correlates r = −1.000.
            This is real physics: GC and AT base pairs have different thermodynamic and
            structural properties, so bulk GC content determines the mean of most biophysical measures.
          </p>
          <p style={pStyle}>
            However, <strong>GC content does not determine dinucleotide arrangement</strong>. Two sequences
            with identical GC can have very different dinucleotide compositions — and different
            biophysical properties. We quantify this using <em>arrangement capacity</em>: the fraction
            of a parameter&apos;s total range accessible through reordering alone, with GC held constant.
          </p>

          <h3 style={h3Style}>Arrangement Capacity at Genome-Average GC (0.41)</h3>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Property</th>
                <th style={thStyle}>Arrangement Capacity</th>
                <th style={thStyle}>Tier</th>
                <th style={thStyle}>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={tdStyle}>Rise</td><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>87%</td><td style={tdStyle}>Arrangement</td><td style={tdStyle}>GC constrains weakly; order determines</td></tr>
              <tr><td style={tdStyle}>Minor groove width</td><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>84%</td><td style={tdStyle}>Arrangement</td><td style={tdStyle}></td></tr>
              <tr><td style={tdStyle}>Twist</td><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>83%</td><td style={tdStyle}>Arrangement</td><td style={tdStyle}></td></tr>
              <tr><td style={tdStyle}>Roll</td><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>81%</td><td style={tdStyle}>Arrangement</td><td style={tdStyle}></td></tr>
              <tr><td style={tdStyle}>Stacking ΔS</td><td style={tdStyle}>64%</td><td style={tdStyle}>Mixed</td><td style={tdStyle}>Substantial from both composition and arrangement</td></tr>
              <tr><td style={tdStyle}>Stacking ΔH</td><td style={tdStyle}>55%</td><td style={tdStyle}>Mixed</td><td style={tdStyle}></td></tr>
              <tr><td style={tdStyle}>Deformability</td><td style={tdStyle}>44%</td><td style={tdStyle}>Mixed</td><td style={tdStyle}>Genome actively exploits this range</td></tr>
              <tr><td style={tdStyle}>Stacking ΔG₃₇</td><td style={tdStyle}>31%</td><td style={tdStyle}>Composition</td><td style={tdStyle}>Mostly determined by GC content</td></tr>
              <tr><td style={tdStyle}>Z-form propensity</td><td style={tdStyle}>9%</td><td style={tdStyle}>Composition</td><td style={tdStyle}>Effectively determined by GC</td></tr>
            </tbody>
          </table>
          <p style={pStyle}>
            These are exact solutions to a linear program — not statistical estimates. The LP
            finds the global optimum over all valid dinucleotide frequency distributions
            consistent with a given GC content.
          </p>
        </div>

        {/* ── Validation ── */}
        <div style={section}>
          <h2 style={h2Style}>Experimental Validation</h2>
          <p style={pStyle}>
            We validated biophysical properties against independent experimental datasets,
            controlling for GC content to ensure the signal is not circular.
          </p>

          <h3 style={h3Style}>DNase-seq Accessibility (ENCODE GM12878, 50K regions)</h3>
          <p style={pStyle}>
            Within GC-matched strata, 6 biophysical properties independently predict chromatin
            accessibility. The strongest: CpG obs/exp ratio (partial r = 0.073), dinucleotide
            entropy (0.063), and thermodynamic heterogeneity (0.062). Signal strengthens in
            GC-rich regions (partial r up to 0.36 at GC 55–60%).
          </p>

          <h3 style={h3Style}>Replication Timing (Repli-seq, 47K regions)</h3>
          <p style={pStyle}>
            7 properties predict replication timing beyond GC. Z-form propensity — despite
            being globally GC-redundant (r = −1.000) — shows the strongest independent
            replication signal (partial r = 0.100) within GC strata. The 0.02% of Z-form
            variance not captured by GC encodes purine-pyrimidine alternation patterns that
            the replication machinery responds to.
          </p>

          <h3 style={h3Style}>MNase-seq Nucleosome Occupancy (GM12878, 4 resolutions)</h3>
          <p style={pStyle}>
            Biophysical predictions describe the chromatin landscape (~1 kb), not individual
            nucleosome positions. Signal strengthens at coarser resolution — mean roll partial r
            goes from 0.081 (147 bp) to 0.286 (1 kb). Periodicity shows no signal at any
            resolution, confirming that in vivo nucleosome positioning is dominated by remodeling.
          </p>
        </div>

        {/* ── Evidence Classes ── */}
        <div style={section}>
          <h2 style={h2Style}>Evidence Classes</h2>
          <p style={pStyle}>
            Every data layer carries an evidence class badge indicating how the data was produced:
          </p>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>Badge</th>
                <th style={thStyle}>Class</th>
                <th style={thStyle}>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>M</td><td style={tdStyle}>Measured</td><td style={tdStyle}>Direct experimental observation (e.g., GTEx expression)</td></tr>
              <tr><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>K</td><td style={tdStyle}>Curated</td><td style={tdStyle}>Expert-assembled (e.g., GENCODE gene models)</td></tr>
              <tr><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>D</td><td style={tdStyle}>Deterministic</td><td style={tdStyle}>Reproducible computation from sequence (e.g., GC content, stacking ΔG)</td></tr>
              <tr><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>S</td><td style={tdStyle}>Statistical</td><td style={tdStyle}>Model with assumptions (e.g., ChromHMM states)</td></tr>
              <tr><td style={{...tdStyle, fontWeight: WEIGHT.bold}}>H</td><td style={tdStyle}>Hypothesis</td><td style={tdStyle}>Theory-led, not yet validated (e.g., bubble propensity)</td></tr>
            </tbody>
          </table>
          <p style={pStyle}>
            Bubble propensity carries evidence class H because its sigmoid parameters
            (center = −1.2 kcal/mol, gain = 4.0) have not been calibrated against
            experimental denaturation data. It should be interpreted as a relative ranking,
            not a probability.
          </p>
        </div>

        {/* ── Conditions ── */}
        <div style={section}>
          <h2 style={h2Style}>Conditions and Limitations</h2>
          <p style={pStyle}>
            <strong>Standard state:</strong> All nearest-neighbor thermodynamic parameters are
            for 37°C, 1 M NaCl (SantaLucia 1998 standard). Physiological conditions (~150 mM NaCl)
            shift absolute ΔG values but largely preserve rank order. The API provides a salt
            correction endpoint for non-standard conditions.
          </p>
          <p style={pStyle}>
            <strong>Naked DNA:</strong> Properties are computed for free B-form DNA without
            proteins, nucleosomes, or topological constraints. In vivo, these are one input
            among many.
          </p>
          <p style={pStyle}>
            <strong>Resolution:</strong> Precomputed tracks are at 1 kb resolution. Per-dinucleotide
            computation is available via the biophysics endpoint (max 1 Mb). Some properties
            (periodicity, phased bending) are only meaningful below ~200 bp.
          </p>
          <p style={pStyle}>
            <strong>Physics linter:</strong> The evaluate/design endpoint detects biophysically
            distinctive features (CpG islands, homopolymers, repeats, Z-form propensity).
            These features have <strong>dual interpretations</strong>: in synthetic constructs, they
            may indicate synthesis difficulty or instability; in genomic sequences, they mark
            active regulatory elements. Validation against 106K K562 lentiMPRA elements (Agarwal
            et al. 2025 Nature) showed that most flagged features associate with <em>higher</em> regulatory
            activity (CpG island OR=2.5, direct repeat d=+0.33). Flags are annotations, not
            pass/fail judgments.
          </p>
        </div>

      </main>
      <Footer />
    </div>
  );
}
