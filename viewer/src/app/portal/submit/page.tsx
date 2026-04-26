import Link from 'next/link';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

export const metadata = {
  title: 'Submit a claim — Polymer Claims',
  description:
    'Install the Polymer Claims harness, run your Claude agent, and open a PR.',
};

const STEPS = [
  {
    n: 1,
    title: 'Install the harness',
    body: (
      <pre
        style={{
          padding: SPACE[3],
          border: `1px solid ${COLOR.border.subtle}`,
          backgroundColor: COLOR.bg.elevated,
          fontSize: TYPE.sm.fontSize,
          lineHeight: 1.6,
          overflowX: 'auto',
          margin: 0,
        }}
      >{`claude /plugin marketplace add beldez01/polymer-claim-marketplace
claude /plugin install claim-harness@polymer-claim-marketplace`}</pre>
    ),
  },
  {
    n: 2,
    title: 'Ask your agent a research question',
    body: (
      <pre
        style={{
          padding: SPACE[3],
          border: `1px solid ${COLOR.border.subtle}`,
          backgroundColor: COLOR.bg.elevated,
          fontSize: TYPE.sm.fontSize,
          lineHeight: 1.6,
          overflowX: 'auto',
          margin: 0,
        }}
      >{`> /author-claim "Do LINE-1 TEs in H3K9me3-enriched regions show \\
  lower ΔG37 variance than expected under GC null?"`}</pre>
    ),
  },
  {
    n: 3,
    title: 'Validate + submit',
    body: (
      <pre
        style={{
          padding: SPACE[3],
          border: `1px solid ${COLOR.border.subtle}`,
          backgroundColor: COLOR.bg.elevated,
          fontSize: TYPE.sm.fontSize,
          lineHeight: 1.6,
          overflowX: 'auto',
          margin: 0,
        }}
      >{`> /validate-claim ./claims/drafts/line1_h3k9me3_dg37.json
LICENSED  (N/N conjuncts true)

> /submit-claim ./claims/drafts/line1_h3k9me3_dg37.json
✓ PR opened: https://github.com/polymerbio/claims/pull/<N>`}</pre>
    ),
  },
];

export default function SubmitPage() {
  return (
    <main
      style={{
        maxWidth: 900,
        margin: '0 auto',
        padding: `${SPACE[8]}px ${SPACE[6]}px`,
        fontFamily: FONT_FAMILY,
      }}
    >
      <h1
        style={{
          color: COLOR.text.primary,
          fontSize: '2rem',
          fontWeight: WEIGHT.medium,
          margin: `0 0 ${SPACE[3]}px`,
          letterSpacing: '-0.01em',
        }}
      >
        Submit a claim
      </h1>
      <p
        style={{
          color: COLOR.text.tertiary,
          fontSize: TYPE.md.fontSize,
          lineHeight: 1.6,
          maxWidth: 720,
          marginBottom: SPACE[8],
        }}
      >
        There is no web form. Authoring happens in your own Claude Code
        session; submission is a pull request under your own GitHub
        identity. The harness never handles your credentials.
      </p>

      <ol style={{ padding: 0, margin: 0, listStyle: 'none' }}>
        {STEPS.map((step) => (
          <li
            key={step.n}
            style={{
              display: 'grid',
              gridTemplateColumns: '48px 1fr',
              gap: SPACE[4],
              marginBottom: SPACE[6],
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                border: `1px solid ${COLOR.accent.teal}`,
                color: COLOR.accent.teal,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: TYPE.md.fontSize,
                fontWeight: WEIGHT.medium,
              }}
            >
              {step.n}
            </div>
            <div>
              <h3
                style={{
                  color: COLOR.text.primary,
                  fontSize: TYPE.lg.fontSize,
                  fontWeight: WEIGHT.medium,
                  margin: `0 0 ${SPACE[2]}px`,
                }}
              >
                {step.title}
              </h3>
              {step.body}
            </div>
          </li>
        ))}
      </ol>

      <div
        style={{
          padding: SPACE[4],
          border: `1px solid ${COLOR.border.subtle}`,
          backgroundColor: COLOR.bg.elevated,
          fontSize: TYPE.sm.fontSize,
          color: COLOR.text.tertiary,
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: COLOR.text.primary }}>Review flow:</strong> CI
        runs the evaluator on your PR. LICENSED from a Tier-1+ contributor
        auto-merges; Tier-0 LICENSED gets admin review within 5 business days.
        Full rules in{' '}
        <Link
          href="https://github.com/polymerbio/claims/blob/main/CONTRIBUTING.md"
          style={{ color: COLOR.accent.teal }}
        >
          CONTRIBUTING.md
        </Link>{' '}
        and{' '}
        <Link
          href="https://github.com/polymerbio/claims/blob/main/GOVERNANCE.md"
          style={{ color: COLOR.accent.teal }}
        >
          GOVERNANCE.md
        </Link>
        .
      </div>
    </main>
  );
}
