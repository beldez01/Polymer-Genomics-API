'use client';

import { useState, useRef, useCallback } from 'react';
import { COLOR, FONT_FAMILY, TYPE, WEIGHT } from '@/config/theme';
import { GLOSSARY, LABEL_TO_KEY } from '@/lib/hla/glossary';

/**
 * Term — dotted-underline text with hover tooltip showing full name + units.
 * Follows the UCSC/gnomAD convention: dotted underline = "hover for definition".
 */
export function Term({ label, style }: { label: string; style?: React.CSSProperties }) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);

  const key = LABEL_TO_KEY[label];
  const entry = key ? GLOSSARY[key] : null;

  const handleEnter = useCallback(() => {
    if (!entry) return;
    timerRef.current = setTimeout(() => setShow(true), 300);
  }, [entry]);

  const handleLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  }, []);

  if (!entry) return <span style={style}>{label}</span>;

  return (
    <span
      ref={wrapRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        ...style,
        borderBottom: `1px dotted ${COLOR.text.faint}`,
        position: 'relative',
        cursor: 'help',
      }}
    >
      {label}
      {show && (
        <span style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: 6,
          whiteSpace: 'nowrap',
          zIndex: 100,
          background: COLOR.bg.surface,
          border: `1px solid ${COLOR.border.strong}`,
          padding: '6px 10px',
          fontFamily: FONT_FAMILY,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          <span style={{ fontSize: TYPE.xs.fontSize, fontWeight: WEIGHT.medium, color: COLOR.text.primary }}>
            {entry.name}
          </span>
          <span style={{ fontSize: 9, color: COLOR.text.muted }}>
            {entry.unit}
          </span>
        </span>
      )}
    </span>
  );
}
