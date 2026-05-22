'use client';

import { useMemo } from 'react';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';

interface SequenceInputProps {
  value: string;
  onChange: (value: string) => void;
  onEvaluate: () => void;
  onUseExample: () => void;
  onClear: () => void;
  loading: boolean;
}

export function SequenceInput({
  value, onChange, onEvaluate, onUseExample, onClear, loading,
}: SequenceInputProps) {
  const stats = useMemo(() => {
    const cleaned = value.replace(/\s/g, '');
    const valid = cleaned.replace(/[^ACGTNacgtn]/g, '');
    const validPct = cleaned.length === 0 ? 100 : (valid.length / cleaned.length) * 100;
    return { len: valid.length, total: cleaned.length, validPct };
  }, [value]);

  const validBadge = stats.total === 0
    ? '—'
    : stats.validPct === 100
      ? 'OK'
      : `${stats.validPct.toFixed(0) }% valid`;

  return (
    <div>
      {/* Header line: SEQUENCE label · length + validity */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        marginBottom: SPACE[2],
      }}>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          Sequence
        </span>
        <span className="tabular" style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.04em',
        }}>
          <span style={{ color: COLOR.text.primary, fontWeight: WEIGHT.medium }}>
            {stats.len.toLocaleString()}
          </span>{' '}
          bp &nbsp;·&nbsp;{' '}
          <span style={{
            color: stats.validPct === 100 ? COLOR.primary.base : COLOR.accent.amber,
            fontWeight: WEIGHT.medium,
          }}>
            {validBadge}
          </span>
        </span>
      </div>

      {/* Textarea */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Paste a DNA sequence (ACGTN). Whitespace and FASTA headers are stripped."
        rows={10}
        style={{
          width: '100%',
          backgroundColor: COLOR.bg.white,
          color: COLOR.text.primary,
          border: `1px solid ${COLOR.border.strong}`,
          borderRadius: 2,
          padding: `${SPACE[3]}px ${SPACE[4]}px`,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.sm.fontSize,
          lineHeight: 1.55,
          letterSpacing: '0.02em',
          outline: 'none',
          resize: 'vertical',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = COLOR.primary.base; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = COLOR.border.strong; }}
      />

      {/* Action row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        marginTop: SPACE[3],
        flexWrap: 'wrap',
      }}>
        <button
          type="button"
          onClick={onEvaluate}
          disabled={loading || stats.len < 10}
          style={{
            backgroundColor: stats.len < 10 ? COLOR.border.strong : COLOR.primary.base,
            color: COLOR.bg.white,
            border: 'none',
            borderRadius: 2,
            padding: `${SPACE[3]}px ${SPACE[5]}px`,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.01em',
            cursor: stats.len < 10 ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            transition: 'background-color 0.12s, opacity 0.12s',
          }}
        >
          {loading ? 'Evaluating…' : 'Evaluate'}
        </button>

        <button
          type="button"
          onClick={onUseExample}
          style={{
            backgroundColor: 'transparent',
            color: COLOR.primary.base,
            border: 'none',
            padding: `${SPACE[3]}px ${SPACE[2]}px`,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.01em',
            cursor: 'pointer',
          }}
        >
          Use example
        </button>

        <button
          type="button"
          onClick={onClear}
          disabled={stats.total === 0}
          style={{
            backgroundColor: 'transparent',
            color: stats.total === 0 ? COLOR.text.faint : COLOR.text.tertiary,
            border: 'none',
            padding: `${SPACE[3]}px ${SPACE[2]}px`,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.01em',
            cursor: stats.total === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          Clear
        </button>

        <span style={{ flex: 1 }} />

        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          Max 100 kb · Batch via POST /v1/evaluate
        </span>
      </div>
    </div>
  );
}
