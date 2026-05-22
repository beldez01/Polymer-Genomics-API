'use client';

import { useState } from 'react';
import { COLOR, FONT_FAMILY_MONO, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
}

export function CodeBlock({ code, language = 'bash', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable — silently no-op
    }
  };

  return (
    <div style={{
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      overflow: 'hidden',
      backgroundColor: COLOR.bg.elevated,
      fontFamily: FONT_FAMILY_MONO,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        backgroundColor: COLOR.bg.deep,
      }}>
        <span style={{
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: 10,
          fontWeight: WEIGHT.semibold,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
        }}>
          {language}
        </span>
        {filename && (
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            letterSpacing: '0.02em',
          }}>
            {filename}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          onClick={onCopy}
          style={{
            backgroundColor: 'transparent',
            color: copied ? COLOR.primary.base : COLOR.text.tertiary,
            border: 'none',
            padding: `2px ${SPACE[2]}px`,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: 10,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            transition: 'color 0.12s',
          }}
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
      </div>

      {/* Code */}
      <pre style={{
        margin: 0,
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        backgroundColor: COLOR.bg.white,
        color: COLOR.text.primary,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.sm.fontSize,
        lineHeight: 1.55,
        letterSpacing: '0.01em',
        overflowX: 'auto',
        whiteSpace: 'pre',
      }}>
        {code}
      </pre>
    </div>
  );
}

// Inline code helper for use within prose
export function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      backgroundColor: COLOR.bg.deep,
      color: COLOR.text.primary,
      fontFamily: FONT_FAMILY_MONO,
      fontSize: '0.92em',
      padding: '1px 6px',
      borderRadius: 2,
      letterSpacing: '0.01em',
    }}>
      {children}
    </span>
  );
}
