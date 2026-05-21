'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { ANALYSIS_MODES, DMP_SUBTABS } from '@/config/methylationMockData';

interface ModeTabsProps {
  activeMode: string;
  onModeChange: (id: string) => void;
  activeSubTab: string;
  onSubTabChange: (id: string) => void;
}

export function ModeTabs({ activeMode, onModeChange, activeSubTab, onSubTabChange }: ModeTabsProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[3] }}>
      {/* Mode row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[4] }}>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          minWidth: 60,
        }}>
          Mode
        </span>
        <div style={{
          display: 'inline-flex',
          border: `1px solid ${COLOR.border.strong}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          {ANALYSIS_MODES.map((m) => {
            const isActive = m.id === activeMode;
            const isAvailable = m.active;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => isAvailable && onModeChange(m.id)}
                disabled={!isAvailable}
                style={{
                  backgroundColor: isActive ? COLOR.primary.base : 'transparent',
                  color: isActive ? COLOR.bg.white : isAvailable ? COLOR.text.secondary : COLOR.text.faint,
                  border: 'none',
                  padding: `${SPACE[2]}px ${SPACE[4]}px`,
                  fontFamily: FONT_FAMILY_MONO,
                  fontSize: TYPE.xs.fontSize,
                  fontWeight: WEIGHT.medium,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: isAvailable ? 'pointer' : 'not-allowed',
                  borderRight: `1px solid ${isActive ? COLOR.primary.base : COLOR.border.subtle}`,
                  transition: 'background-color 0.12s, color 0.12s',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Sub-tabs row */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE[4] }}>
        <span style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          minWidth: 60,
        }}>
          View
        </span>
        <div style={{ display: 'flex', gap: SPACE[1] }}>
          {DMP_SUBTABS.map((t) => {
            const isActive = t.id === activeSubTab;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => t.available && onSubTabChange(t.id)}
                disabled={!t.available}
                style={{
                  backgroundColor: 'transparent',
                  color: isActive
                    ? COLOR.primary.base
                    : t.available ? COLOR.text.secondary : COLOR.text.faint,
                  border: 'none',
                  borderBottom: `2px solid ${isActive ? COLOR.primary.base : 'transparent'}`,
                  padding: `${SPACE[2]}px ${SPACE[3]}px`,
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.sm.fontSize,
                  fontWeight: isActive ? WEIGHT.semibold : WEIGHT.medium,
                  letterSpacing: '0.01em',
                  cursor: t.available ? 'pointer' : 'not-allowed',
                  transition: 'color 0.12s, border-color 0.12s',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
