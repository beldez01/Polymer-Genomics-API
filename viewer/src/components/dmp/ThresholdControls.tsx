'use client';

import { useState } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import type { ThresholdState } from '@/lib/dmp/types';

interface ThresholdControlsProps {
  thresholds: ThresholdState;
  onChange: (t: ThresholdState) => void;
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  displayValue: string;
  onChange: (v: number) => void;
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE[3],
    }}>
      <span style={{
        color: COLOR.text.secondary,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        minWidth: 100,
      }}>
        {label}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{
          flex: 1,
          accentColor: COLOR.accent.teal,
          height: 4,
          cursor: 'pointer',
        }}
      />
      <span style={{
        color: COLOR.accent.teal,
        fontSize: TYPE.xs.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
        minWidth: 70,
        textAlign: 'right',
      }}>
        {displayValue}
      </span>
    </div>
  );
}

export function ThresholdControls({ thresholds, onChange }: ThresholdControlsProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div style={{
      backgroundColor: COLOR.bg.elevated,
      border: `1px solid ${COLOR.border.subtle}`,
      padding: SPACE[3],
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          ...COMPONENT.sectionHeader,
          marginBottom: collapsed ? 0 : SPACE[3],
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[2],
          userSelect: 'none',
        }}
      >
        <span style={{ fontSize: 8, color: COLOR.text.muted }}>
          {collapsed ? '\u25B6' : '\u25BC'}
        </span>
        THRESHOLDS
      </div>

      {!collapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[2] }}>
          <SliderRow
            label="adj. p-value"
            value={-Math.log10(thresholds.adjPValueCutoff)}
            min={1}
            max={10}
            step={0.1}
            displayValue={thresholds.adjPValueCutoff < 0.001
              ? thresholds.adjPValueCutoff.toExponential(1)
              : thresholds.adjPValueCutoff.toFixed(3)
            }
            onChange={(v) => onChange({ ...thresholds, adjPValueCutoff: Math.pow(10, -v), pValueCutoff: v })}
          />
          <SliderRow
            label="|delta beta|"
            value={thresholds.deltaBetaCutoff}
            min={0}
            max={0.5}
            step={0.01}
            displayValue={thresholds.deltaBetaCutoff.toFixed(2)}
            onChange={(v) => onChange({ ...thresholds, deltaBetaCutoff: v })}
          />
        </div>
      )}
    </div>
  );
}
