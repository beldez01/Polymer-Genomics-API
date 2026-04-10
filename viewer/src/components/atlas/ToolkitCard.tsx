'use client';

import Link from 'next/link';
import { COLOR, TYPE, FONT_FAMILY, WEIGHT, SPACE } from '@/config/theme';
import type { ToolkitCardData } from '@/config/toolkit-cards';

interface ToolkitCardProps {
  card: ToolkitCardData;
}

const SPARK_WIDTH = 300;
const SPARK_HEIGHT = 72;

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const padY = SPARK_HEIGHT * 0.18;
  const stepX = SPARK_WIDTH / (data.length - 1);

  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = SPARK_HEIGHT - padY - ((v - min) / range) * (SPARK_HEIGHT - 2 * padY);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const area = `0,${SPARK_HEIGHT} ${points} ${SPARK_WIDTH},${SPARK_HEIGHT}`;

  return (
    <svg
      width="100%"
      height={SPARK_HEIGHT}
      viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
      preserveAspectRatio="none"
      style={{ display: 'block' }}
    >
      <polyline points={area} fill={`${color}14`} stroke="none" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function ToolkitCard({ card }: ToolkitCardProps) {
  return (
    <Link
      href={card.href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: COLOR.bg.track,
        textDecoration: 'none',
        transition: 'background-color 0.2s, transform 0.2s',
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = COLOR.bg.surface;
        e.currentTarget.style.transform = 'translateY(-2px)';
        const strip = e.currentTarget.querySelector<HTMLDivElement>('[data-strip]');
        if (strip) strip.style.height = '5px';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = COLOR.bg.track;
        e.currentTarget.style.transform = 'translateY(0)';
        const strip = e.currentTarget.querySelector<HTMLDivElement>('[data-strip]');
        if (strip) strip.style.height = '3px';
      }}
    >
      {/* Module color signature strip */}
      <div
        data-strip
        style={{
          height: 3,
          backgroundColor: card.color,
          transition: 'height 0.2s',
        }}
      />

      <div style={{
        padding: `${SPACE[5]}px ${SPACE[5]}px ${SPACE[6]}px`,
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}>
        {/* Overline: number + MODULE */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: SPACE[3],
        }}>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
          }}>
            {card.number} / Module
          </span>
        </div>

        {/* Title */}
        <div style={{
          fontSize: TYPE.lg.fontSize,
          fontWeight: WEIGHT.medium,
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.02em',
          lineHeight: 1.15,
        }}>
          {card.title}
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: TYPE.base.fontSize,
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY,
          marginTop: SPACE[2],
          letterSpacing: '0.01em',
          lineHeight: 1.5,
        }}>
          {card.tagline}
        </div>

        {/* Sparkline (inline, full-bleed relative to card padding) */}
        <div style={{
          marginTop: SPACE[5],
          marginBottom: SPACE[4],
          marginLeft: -SPACE[5],
          marginRight: -SPACE[5],
        }}>
          <Sparkline data={card.sparkline} color={card.color} />
        </div>

        {/* Activity row */}
        <div style={{
          fontSize: TYPE.sm.fontSize,
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          lineHeight: 1.5,
        }}>
          {card.activity}
        </div>

        {/* Latest claim — blockquote with module-color rule */}
        <div style={{
          marginTop: 'auto',
          paddingTop: SPACE[4],
        }}>
          <div style={{
            borderLeft: `2px solid ${card.color}`,
            paddingLeft: SPACE[3],
            fontSize: TYPE.base.fontSize,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.55,
            letterSpacing: '0.01em',
          }}>
            {card.latestClaim}
          </div>
        </div>
      </div>
    </Link>
  );
}
