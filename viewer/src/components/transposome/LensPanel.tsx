'use client';

import { COLOR, FONT_FAMILY, TYPE, WEIGHT } from '@/config/theme';
import { LENS_OPTIONS, Y_AXIS_OPTIONS } from '@/lib/transposome-types';
import type { TEClass, Lens, YAxis } from '@/lib/transposome-types';
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

const LENS_BTN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '7px 10px',
  background: 'transparent',
  border: '1px solid transparent',
  color: COLOR.text.tertiary,
  fontSize: 10,
  fontFamily: FONT_FAMILY,
  cursor: 'pointer',
  textAlign: 'left' as const,
  marginBottom: 2,
  transition: 'all 0.15s',
};

const LENS_BTN_ACTIVE: React.CSSProperties = {
  ...LENS_BTN,
  background: 'rgba(78,205,196,0.15)',
  borderColor: 'rgba(78,205,196,0.3)',
  color: COLOR.accent.teal,
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
      {/* INTERPRETIVE LENS */}
      <div style={SECTION_TITLE_FIRST}>INTERPRETIVE LENS</div>
      {LENS_OPTIONS.map((opt) => {
        const isActive = store.activeLens === opt.value;
        const isDisabled = !opt.mvp;
        return (
          <button
            key={opt.value}
            onClick={() => !isDisabled && store.setActiveLens(opt.value as Lens)}
            style={{
              ...(isActive ? LENS_BTN_ACTIVE : LENS_BTN),
              ...(isDisabled ? { opacity: 0.3, cursor: 'default' } : {}),
            }}
          >
            <span style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: '1.5px solid currentColor',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 7,
              flexShrink: 0,
              lineHeight: 1,
            }}>
              {opt.icon}
            </span>
            {opt.label}
          </button>
        );
      })}

      {/* Y-AXIS */}
      <div style={SECTION_TITLE}>Y-AXIS</div>
      <select
        value={store.yAxis}
        onChange={(e) => store.setYAxis(e.target.value as YAxis)}
        style={{
          background: COLOR.bg.surface,
          border: `1px solid ${COLOR.border.default}`,
          color: COLOR.text.secondary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          width: '100%',
          padding: '5px 8px',
          outline: 'none',
        }}
      >
        {Y_AXIS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* CLASS FILTER */}
      <div style={SECTION_TITLE}>CLASS FILTER</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {CLASS_OPTIONS.map((opt) => {
          const isActive = opt.value === 'All'
            ? store.classFilter.length === 0
            : store.classFilter.includes(opt.value as TEClass);
          return (
            <button
              key={opt.value}
              onClick={() => {
                if (opt.value === 'All') {
                  store.setAllClasses();
                } else {
                  store.toggleClassFilter(opt.value as TEClass);
                }
              }}
              style={isActive ? PILL_ACTIVE : PILL}
            >
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

      {/* AWAKENING GRADIENT */}
      <div style={SECTION_TITLE}>AWAKENING GRADIENT</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 8, color: COLOR.text.faint, fontFamily: FONT_FAMILY }}>DEEPLY SILENT</span>
        <span style={{ fontSize: 8, color: COLOR.accent.rose, fontFamily: FONT_FAMILY }}>EXPOSED</span>
      </div>
      <div style={{
        height: 4,
        borderRadius: 2,
        background: 'linear-gradient(to right, #555, #F0A500, #F43F5E)',
        opacity: 0.6,
        marginBottom: 6,
      }} />
      <input
        type="range"
        min={0}
        max={100}
        value={store.awakeningThreshold}
        onChange={(e) => store.setAwakeningThreshold(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: COLOR.accent.teal,
        }}
      />
    </div>
  );
}
