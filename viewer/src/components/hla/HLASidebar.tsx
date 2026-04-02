'use client';

import { COLOR, FONT_FAMILY, WEIGHT } from '@/config/theme';
import { HLA_LOCI, CLASS_I_LOCI, CLASS_II_LOCI } from '@/lib/hla/types';
import type { HLALocus, HLAClass, LocusSummary, HLATab } from '@/lib/hla/types';

/* ── Shared styles (matches LensPanel) ── */

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 9,
  fontWeight: WEIGHT.medium,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: COLOR.text.faint,
  fontFamily: FONT_FAMILY,
  marginTop: 16,
  marginBottom: 8,
};

const SECTION_TITLE_FIRST: React.CSSProperties = { ...SECTION_TITLE, marginTop: 0 };

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

const STAT_ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '2px 0',
};

const STAT_LABEL: React.CSSProperties = { fontSize: 9, color: COLOR.text.muted, fontFamily: FONT_FAMILY };
const STAT_VALUE: React.CSSProperties = {
  fontSize: 10, color: COLOR.text.secondary, fontFamily: FONT_FAMILY,
  fontWeight: WEIGHT.medium, fontVariantNumeric: 'tabular-nums',
};

const DIVIDER: React.CSSProperties = { height: 1, background: COLOR.border.subtle, margin: '12px 0 4px' };

const LENS_BTN: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
  padding: '7px 10px', background: 'transparent', border: '1px solid transparent',
  color: COLOR.text.tertiary, fontSize: 10, fontFamily: FONT_FAMILY,
  cursor: 'pointer', textAlign: 'left' as const, marginBottom: 2, transition: 'all 0.15s',
};

const LENS_BTN_ACTIVE: React.CSSProperties = {
  ...LENS_BTN,
  background: 'rgba(78,205,196,0.15)',
  borderColor: 'rgba(78,205,196,0.3)',
  color: COLOR.accent.teal,
};

/* ── Props ── */

interface HLASidebarProps {
  selectedLocus: HLALocus | null;
  onSelectLocus: (locus: HLALocus) => void;
  classFilter: HLAClass | null;
  onClassFilter: (cls: HLAClass | null) => void;
  genomicOnly: boolean;
  onGenomicOnly: (v: boolean) => void;
  alleleGroup: string;
  onAlleleGroup: (v: string) => void;
  alleleGroups: string[];
  loci: LocusSummary[];
  activeTab: HLATab;
  onTabChange: (tab: HLATab) => void;
}

/* ── Component ── */

export function HLASidebar({
  selectedLocus, onSelectLocus,
  classFilter, onClassFilter,
  genomicOnly, onGenomicOnly,
  alleleGroup, onAlleleGroup,
  alleleGroups,
  loci,
  activeTab, onTabChange,
}: HLASidebarProps) {
  const currentLocus = loci.find((l) => l.locus === selectedLocus);

  const filteredLoci = classFilter
    ? HLA_LOCI.filter((l) =>
        classFilter === 1 ? CLASS_I_LOCI.includes(l) : CLASS_II_LOCI.includes(l),
      )
    : [...HLA_LOCI];

  const TABS: { key: HLATab; label: string; icon: string }[] = [
    { key: 'alleles', label: 'Allele Browser', icon: 'A' },
    { key: 'compare', label: 'Compare', icon: 'C' },
    { key: 'divergence', label: 'NC Divergence', icon: 'D' },
    { key: 'expression', label: 'Expression', icon: 'E' },
  ];

  return (
    <div style={{ fontFamily: FONT_FAMILY }}>

      {/* ── ANALYSIS MODE ── */}
      <div style={SECTION_TITLE_FIRST}>ANALYSIS</div>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            style={isActive ? LENS_BTN_ACTIVE : LENS_BTN}
          >
            <span style={{
              width: 14, height: 14, borderRadius: '50%',
              border: '1.5px solid currentColor',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7, flexShrink: 0, lineHeight: 1,
            }}>
              {tab.icon}
            </span>
            {tab.label}
          </button>
        );
      })}

      {/* ── HLA CLASS ── */}
      <div style={SECTION_TITLE}>HLA CLASS</div>
      <div style={{ display: 'flex', gap: 3 }}>
        <button
          onClick={() => onClassFilter(null)}
          style={classFilter === null ? PILL_ACTIVE : PILL}
        >
          All
        </button>
        <button
          onClick={() => onClassFilter(classFilter === 1 ? null : 1)}
          style={classFilter === 1 ? PILL_ACTIVE : PILL}
        >
          Class I
        </button>
        <button
          onClick={() => onClassFilter(classFilter === 2 ? null : 2)}
          style={classFilter === 2 ? PILL_ACTIVE : PILL}
        >
          Class II
        </button>
      </div>

      {/* ── LOCUS ── */}
      <div style={SECTION_TITLE}>LOCUS</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {filteredLoci.map((l) => {
          const isActive = selectedLocus === l;
          const short = l.replace('HLA-', '');
          return (
            <button
              key={l}
              onClick={() => onSelectLocus(l)}
              style={isActive ? PILL_ACTIVE : PILL}
            >
              {short}
            </button>
          );
        })}
      </div>

      {/* ── FILTERS ── */}
      <div style={SECTION_TITLE}>FILTERS</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <button
          onClick={() => onGenomicOnly(!genomicOnly)}
          style={genomicOnly ? PILL_ACTIVE : PILL}
        >
          Genomic sequences only
        </button>
      </div>

      {/* ── ALLELE GROUP ── */}
      {selectedLocus && alleleGroups.length > 0 && (
        <>
          <div style={SECTION_TITLE}>ALLELE GROUP</div>
          <select
            value={alleleGroup}
            onChange={(e) => onAlleleGroup(e.target.value)}
            style={{
              background: COLOR.bg.surface,
              border: `1px solid ${COLOR.border.default}`,
              color: COLOR.text.secondary,
              fontSize: 10,
              fontFamily: FONT_FAMILY,
              width: '100%',
              padding: '5px 8px',
              outline: 'none',
            }}
          >
            <option value="">All groups</option>
            {alleleGroups.map((g) => (
              <option key={g} value={g}>{selectedLocus?.replace('HLA-', '')}*{g}</option>
            ))}
          </select>
        </>
      )}

      <div style={DIVIDER} />

      {/* ── LOCUS STATS ── */}
      {currentLocus && (
        <>
          <div style={SECTION_TITLE}>LOCUS STATS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>total alleles</span>
              <span style={STAT_VALUE}>{currentLocus.total_alleles.toLocaleString()}</span>
            </div>
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>genomic</span>
              <span style={STAT_VALUE}>{currentLocus.genomic_alleles.toLocaleString()}</span>
            </div>
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>GC content</span>
              <span style={STAT_VALUE}>
                {currentLocus.mean_gc_content?.toFixed(3) ?? '—'}
              </span>
            </div>
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>mean ΔG₃₇</span>
              <span style={STAT_VALUE}>
                {currentLocus.mean_stacking_dg37?.toFixed(3) ?? '—'}
              </span>
            </div>
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>mean Tm</span>
              <span style={STAT_VALUE}>
                {currentLocus.mean_melting_temp?.toFixed(1) ?? '—'}°C
              </span>
            </div>
          </div>

          {/* NC biophysics */}
          <div style={SECTION_TITLE}>NON-CODING</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>nc GC</span>
              <span style={STAT_VALUE}>
                {currentLocus.mean_nc_gc_content?.toFixed(3) ?? '—'}
              </span>
            </div>
            <div style={STAT_ROW}>
              <span style={STAT_LABEL}>nc ΔG₃₇</span>
              <span style={STAT_VALUE}>
                {currentLocus.mean_nc_stacking_dg37?.toFixed(3) ?? '—'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* ── BUILD INFO ── */}
      <div style={{ marginTop: 'auto', paddingTop: 16 }}>
        <div style={DIVIDER} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 8 }}>
          <div style={STAT_ROW}>
            <span style={{ ...STAT_LABEL, fontSize: 8 }}>source</span>
            <span style={{ ...STAT_VALUE, fontSize: 8 }}>IPD-IMGT/HLA</span>
          </div>
          <div style={STAT_ROW}>
            <span style={{ ...STAT_LABEL, fontSize: 8 }}>ref</span>
            <span style={{ ...STAT_VALUE, fontSize: 8 }}>Bettens 2022</span>
          </div>
          <div style={STAT_ROW}>
            <span style={{ ...STAT_LABEL, fontSize: 8 }}>build</span>
            <span style={{ ...STAT_VALUE, fontSize: 8 }}>hg38</span>
          </div>
        </div>
      </div>
    </div>
  );
}
