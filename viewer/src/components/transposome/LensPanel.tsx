'use client';

import { COLOR, FONT_FAMILY, WEIGHT } from '@/config/theme';
import type { TEClass } from '@/lib/transposome-types';
import { useTransposome } from '@/stores/transposome';

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: WEIGHT.medium,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: COLOR.text.faint,
  fontFamily: FONT_FAMILY,
  marginTop: 16,
  marginBottom: 10,
};

const SECTION_TITLE_FIRST: React.CSSProperties = {
  ...SECTION_TITLE,
  marginTop: 0,
};

const PILL: React.CSSProperties = {
  fontSize: 9,
  fontFamily: 'inherit',
  padding: '3px 7px',
  background: 'transparent',
  border: `1px solid ${COLOR.border.default}`,
  color: COLOR.text.muted,
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const PILL_ACTIVE: React.CSSProperties = {
  ...PILL,
  borderColor: COLOR.accent.teal,
  color: COLOR.accent.teal,
  background: 'rgba(78,205,196,0.15)',
};

const CLASS_COLORS: Record<string, string> = {
  LINE: COLOR.repeat.LINE,
  SINE: COLOR.repeat.SINE,
  LTR: COLOR.repeat.LTR,
  DNA: COLOR.repeat.DNA,
  SVA: '#a855f7',
  Other: COLOR.repeat.Other,
};

const CLASS_OPTIONS: { label: string; value: TEClass | 'All' }[] = [
  { label: 'All', value: 'All' },
  { label: 'LINE', value: 'LINE' },
  { label: 'SINE', value: 'SINE' },
  { label: 'LTR', value: 'LTR' },
  { label: 'DNA', value: 'DNA' },
  { label: 'SVA', value: 'SVA' },
  { label: 'Other', value: 'Other' },
];

const AGE_OPTIONS: { label: string; range: number[] }[] = [
  { label: 'All', range: [] },
  { label: '<10 Mya', range: [0, 3] },
  { label: '10-50', range: [3, 10] },
  { label: '50-150', range: [10, 20] },
  { label: '>150', range: [20, 100] },
];

const QUICK_FILTERS = [
  { label: 'CpG-rich only', key: 'cpgRichOnly' as const },
  { label: 'Probe-covered only', key: 'probeCoveredOnly' as const },
  { label: 'Perturbation responsive', key: 'perturbationResponsiveOnly' as const },
];

export function LensPanel() {
  const store = useTransposome();

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>
      {/* CLASS FILTER */}
      <div style={SECTION_TITLE_FIRST}>CLASS FILTER</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {CLASS_OPTIONS.map((opt) => {
          const isAll = opt.value === 'All';
          const isActive = isAll
            ? store.classFilter.length === 0
            : store.classFilter.includes(opt.value as TEClass);
          const classColor = !isAll ? CLASS_COLORS[opt.value] : undefined;
          return (
            <button
              key={opt.value}
              onClick={() => {
                if (isAll) {
                  store.setAllClasses();
                } else {
                  store.toggleClassFilter(opt.value as TEClass);
                }
              }}
              style={{
                ...(isActive ? PILL_ACTIVE : PILL),
                ...(isActive && classColor ? {
                  borderColor: classColor,
                  color: classColor,
                  background: `${classColor}20`,
                } : {}),
              }}
            >
              {!isAll && (
                <span style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: classColor,
                  marginRight: 4,
                  verticalAlign: 'middle',
                  opacity: isActive ? 1 : 0.5,
                }} />
              )}
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* AGE RANGE */}
      <div style={SECTION_TITLE}>AGE RANGE</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {AGE_OPTIONS.map((opt) => {
          const isActive = JSON.stringify(store.ageRange) === JSON.stringify(opt.range);
          return (
            <button
              key={opt.label}
              onClick={() => store.setAgeRange(opt.range)}
              style={isActive ? PILL_ACTIVE : PILL}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* QUICK FILTERS */}
      <div style={SECTION_TITLE}>QUICK FILTERS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {QUICK_FILTERS.map((f) => {
          const isActive = store[f.key];
          const toggle = f.key === 'cpgRichOnly'
            ? store.toggleCpgRich
            : f.key === 'probeCoveredOnly'
              ? store.toggleProbeCovered
              : store.togglePerturbationResponsive;
          return (
            <button
              key={f.key}
              onClick={toggle}
              style={isActive ? PILL_ACTIVE : PILL}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
