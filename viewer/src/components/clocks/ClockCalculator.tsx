'use client';

import { useState } from 'react';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { CLOCKS, predictAge } from '@/config/clocksMockData';

export function ClockCalculator() {
  const [chronoAge, setChronoAge] = useState(45);

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.default}`,
      borderRadius: 2,
      padding: SPACE[5],
    }}>
      {/* Input */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[5],
        paddingBottom: SPACE[4],
        borderBottom: `1px solid ${COLOR.border.subtle}`,
        marginBottom: SPACE[4],
      }}>
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          minWidth: 140,
        }}>
          Chronological age
        </span>
        <input
          type="range"
          min={18}
          max={95}
          step={1}
          value={chronoAge}
          onChange={(e) => setChronoAge(parseInt(e.target.value, 10))}
          style={{
            flex: 1,
            accentColor: COLOR.primary.base,
          }}
        />
        <span className="tabular" style={{
          color: COLOR.primary.base,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.lg.fontSize,
          fontWeight: WEIGHT.semibold,
          minWidth: 64,
          textAlign: 'right',
        }}>
          {chronoAge} <span style={{ fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize, color: COLOR.text.tertiary, letterSpacing: '0.06em' }}>yr</span>
        </span>
      </div>

      {/* Per-clock predictions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
        {CLOCKS.map((c) => {
          const predicted = predictAge(c, chronoAge);
          const isPace = c.unit === 'pace';
          const delta = isPace ? predicted - 1 : predicted - chronoAge;
          const accelColor = isPace
            ? (delta > 0.05 ? COLOR.accent.rose : delta < -0.05 ? COLOR.primary.base : COLOR.text.secondary)
            : (delta > 1 ? COLOR.accent.rose : delta < -1 ? COLOR.primary.base : COLOR.text.secondary);

          // Bar position relative to chrono age, max ±15 yr (or ±0.3 pace)
          const maxAbs = isPace ? 0.3 : 15;
          const barFrac = Math.max(-1, Math.min(1, delta / maxAbs));

          return (
            <div key={c.id} style={{
              display: 'grid',
              gridTemplateColumns: '160px 1fr 100px',
              alignItems: 'center',
              columnGap: SPACE[4],
              paddingTop: SPACE[2],
              paddingBottom: SPACE[2],
              borderBottom: `1px solid ${COLOR.border.subtle}`,
            }}>
              <span style={{
                color: COLOR.text.primary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.base.fontSize,
                fontWeight: WEIGHT.medium,
              }}>
                {c.name}
              </span>

              {/* Bar — center is "no acceleration" */}
              <div style={{ position: 'relative', height: 14 }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: 6,
                  height: 2,
                  backgroundColor: COLOR.border.default,
                }} />
                {/* Center tick */}
                <div style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: 1,
                  backgroundColor: COLOR.border.strong,
                }} />
                {/* Bar */}
                <div style={{
                  position: 'absolute',
                  left: barFrac >= 0 ? '50%' : `${50 + barFrac * 50}%`,
                  width: `${Math.abs(barFrac) * 50}%`,
                  top: 4,
                  height: 6,
                  backgroundColor: accelColor,
                }} />
              </div>

              <span className="tabular" style={{
                color: accelColor,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: TYPE.sm.fontSize,
                fontWeight: WEIGHT.semibold,
                letterSpacing: '0.01em',
                textAlign: 'right',
              }}>
                {isPace
                  ? `${predicted.toFixed(2)} yr/yr`
                  : `${predicted.toFixed(1)} yr`}
                <span style={{
                  display: 'block',
                  color: accelColor,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: 10,
                  fontWeight: WEIGHT.medium,
                  marginTop: 1,
                }}>
                  {delta > 0 ? '+' : ''}{isPace ? delta.toFixed(2) : delta.toFixed(1)}
                </span>
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        marginTop: SPACE[4],
        color: COLOR.text.faint,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        letterSpacing: '0.08em',
        textAlign: 'center',
      }}>
        Bar shows acceleration (predicted − chronological). Hyper-methylated probes drive higher predictions.
      </div>
    </div>
  );
}
