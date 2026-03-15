'use client';

import { useEffect, useMemo } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { ModeTabs } from '@/components/transposome/ModeTabs';
import { LensPanel } from '@/components/transposome/LensPanel';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { fetchTEFamilies } from '@/lib/api';
import { useTransposome, filterFamilies } from '@/stores/transposome';

export default function TransposomePage() {
  const store = useTransposome();

  // Data loading
  useEffect(() => {
    fetchTEFamilies()
      .then((res) => store.setFamilies(res.data.families))
      .catch((err) => store.setError(err instanceof Error ? err.message : 'Failed to load families'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filtered families
  const filteredFamilies = useMemo(
    () => filterFamilies(store),
    [
      store.families,
      store.classFilter,
      store.ageRange,
      store.cpgRichOnly,
      store.probeCoveredOnly,
      store.perturbationResponsiveOnly,
      store.awakeningThreshold,
      store.searchQuery,
    ],
  );

  // Stats
  const totalBp = store.families.reduce((sum, f) => sum + f.total_bp, 0);
  const genomeFraction = ((totalBp / 3_088_269_832) * 100).toFixed(1);
  const totalProbes = store.families.reduce((sum, f) => sum + f.epic_v2_probes, 0);

  const STAT_VALUE: React.CSSProperties = {
    fontSize: 18,
    fontWeight: WEIGHT.bold,
    color: COLOR.text.primary,
    fontFamily: FONT_FAMILY,
  };

  const STAT_LABEL: React.CSSProperties = {
    fontSize: 9,
    fontWeight: WEIGHT.medium,
    color: COLOR.text.faint,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    fontFamily: FONT_FAMILY,
  };

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <BrandBar subtitle="Transposome Explorer" sticky />

      {/* Hero Header */}
      <div style={{ padding: '32px 24px 20px', borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        <h1 style={{
          color: COLOR.accent.teal,
          fontSize: TYPE.xl.fontSize,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.06em',
          fontFamily: FONT_FAMILY,
          margin: 0,
          textTransform: 'uppercase',
        }}>
          TRANSPOSOME EXPLORER
        </h1>
        <p style={{
          fontStyle: 'italic',
          fontSize: 12,
          color: COLOR.text.muted,
          fontFamily: FONT_FAMILY,
          margin: '4px 0 12px',
        }}>
          Mechanics, Age, Awakening
        </p>
        <p style={{
          fontSize: TYPE.sm.fontSize,
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY,
          maxWidth: 900,
          lineHeight: 1.7,
          margin: '0 0 16px',
        }}>
          Transposable elements are not a side note to genome biology. They are a vast population of latent
          genomic entities, each with distinct age, sequence architecture, repression logic, and failure modes.
          This explorer renders the transposome as a navigable landscape, linking repeat families to biophysical
          properties, silencing mechanisms, assay observability, and reactivation potential.
        </p>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: SPACE[8], flexWrap: 'wrap' }}>
          <div>
            <div style={STAT_VALUE}>{store.families.length}</div>
            <div style={STAT_LABEL}>Families</div>
          </div>
          <div>
            <div style={STAT_VALUE}>5,633,664</div>
            <div style={STAT_LABEL}>Annotated Elements</div>
          </div>
          <div>
            <div style={STAT_VALUE}>{genomeFraction}%</div>
            <div style={STAT_LABEL}>Genome Fraction</div>
          </div>
          <div>
            <div style={STAT_VALUE}>{totalProbes.toLocaleString()}</div>
            <div style={STAT_LABEL}>EPIC v2 Probes</div>
          </div>
        </div>
      </div>

      {/* Mode Tabs */}
      <ModeTabs activeTab="landscape" onTabChange={() => {}} />

      {/* Three-Panel Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '220px 1fr 300px',
        flex: 1,
        minHeight: 500,
        overflow: 'hidden',
      }}>
        {/* Left Rail */}
        <div style={{
          borderRight: `1px solid ${COLOR.border.subtle}`,
          background: COLOR.bg.elevated,
          overflowY: 'auto',
          padding: '16px 12px',
        }}>
          <LensPanel />
        </div>

        {/* Center - Landscape placeholder */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          background: COLOR.bg.primary,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: COLOR.text.faint,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            Landscape Canvas — {filteredFamilies.length} families
          </div>
        </div>

        {/* Right Panel - Inspector placeholder */}
        <div style={{
          borderLeft: `1px solid ${COLOR.border.subtle}`,
          background: COLOR.bg.elevated,
          overflowY: 'auto',
          padding: '16px 14px',
        }}>
          <div style={{
            color: COLOR.text.muted,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            textAlign: 'center',
            paddingTop: 40,
          }}>
            Select a family in the landscape to inspect.
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
