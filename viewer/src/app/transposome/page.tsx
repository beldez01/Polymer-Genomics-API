'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { ModeTabs } from '@/components/transposome/ModeTabs';
import { LensPanel } from '@/components/transposome/LensPanel';
import { LandscapeCanvas } from '@/components/transposome/LandscapeCanvas';
import { FamilyInspector } from '@/components/transposome/FamilyInspector';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { fetchTEFamilies } from '@/lib/api';
import { MOCK_FAMILIES } from '@/lib/transposome-mock';
import { useTransposome, filterFamilies } from '@/stores/transposome';
import { useIsMobile } from '@/hooks/useBreakpoint';

export default function TransposomePage() {
  const store = useTransposome();
  const isMobile = useIsMobile();
  const [dataMode, setDataMode] = useState<'live' | 'demo'>('live');

  // Live data loading — failures are surfaced explicitly so users can decide
  // whether to retry or inspect the demo dataset.
  const loadData = useCallback(() => {
    store.setLoading(true);
    store.setError(null);
    fetchTEFamilies()
      .then((res) => {
        setDataMode('live');
        store.setFamilies(res.data.families);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Failed to load live transposome data.';
        store.setError(message);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDemoData = useCallback(() => {
    setDataMode('demo');
    store.setError(null);
    store.setFamilies(MOCK_FAMILIES);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Center panel content (loading / error / canvas)
  let centerContent: React.ReactNode;
  if (store.loading) {
    centerContent = (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: 8,
      }}>
        <style>{`@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(350%); } }`}</style>
        <div style={{
          width: 200, height: 4, borderRadius: 2,
          background: COLOR.bg.surface, overflow: 'hidden',
        }}>
          <div style={{
            width: '40%', height: '100%', borderRadius: 2,
            background: `linear-gradient(90deg, ${COLOR.bg.surface}, ${COLOR.accent.teal}, ${COLOR.bg.surface})`,
            animation: 'shimmer 1.5s infinite',
          }} />
        </div>
        <span style={{ color: COLOR.text.faint, fontSize: TYPE.xs.fontSize, fontFamily: FONT_FAMILY }}>
          Loading transposome data...
        </span>
      </div>
    );
  } else if (store.error) {
    centerContent = (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: 12,
      }}>
        <span style={{ color: COLOR.accent.rose, fontSize: TYPE.sm.fontSize, fontFamily: FONT_FAMILY }}>
          {store.error}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={loadData}
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${COLOR.border.strong}`,
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.xs.fontSize,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Retry Live Data
          </button>
          <button
            onClick={loadDemoData}
            style={{
              backgroundColor: `${COLOR.accent.amber}12`,
              border: `1px solid ${COLOR.accent.amber}55`,
              color: COLOR.accent.amber,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.xs.fontSize,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Load Demo Dataset
          </button>
        </div>
      </div>
    );
  } else {
    centerContent = (
      <LandscapeCanvas families={filteredFamilies} allFamilies={store.families} />
    );
  }

  return (
    <main style={{ backgroundColor: COLOR.bg.primary, height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <BrandBar subtitle="Transposome Explorer" sticky>
        <input
          type="text"
          placeholder="Search families..."
          value={store.searchQuery}
          onChange={(e) => store.setSearchQuery(e.target.value)}
          style={{
            backgroundColor: COLOR.bg.track,
            border: `1px solid ${COLOR.border.strong}`,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xs.fontSize,
            padding: '4px 10px',
            width: 180,
            outline: 'none',
          }}
        />
      </BrandBar>

      {/* Preview disclosure */}
      <div style={{
        backgroundColor: `${COLOR.accent.amber}15`,
        borderBottom: `1px solid ${COLOR.accent.amber}40`,
        padding: `${SPACE[2]}px 24px`,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE[3],
      }}>
        <span style={{
          color: COLOR.accent.amber,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
          letterSpacing: '0.06em',
        }}>
          BETA
        </span>
        <span style={{
          color: COLOR.text.secondary,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          Aggregated from 5.3M RepeatMasker elements. Biophysics properties are heuristic estimates pending full per-element computation.
        </span>
      </div>

      {dataMode === 'demo' && (
        <div style={{
          backgroundColor: `${COLOR.accent.rose}12`,
          borderBottom: `1px solid ${COLOR.accent.rose}40`,
          padding: `${SPACE[2]}px 24px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE[3],
          flexWrap: 'wrap',
        }}>
          <span style={{
            color: COLOR.text.secondary,
            fontSize: TYPE.xs.fontSize,
            fontFamily: FONT_FAMILY,
            lineHeight: 1.5,
          }}>
            Using the local demo dataset because the live transposome endpoint did not load. Review behavior, but do not treat the current values as live production data.
          </span>
          <button
            onClick={loadData}
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${COLOR.border.strong}`,
              color: COLOR.text.secondary,
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.xs.fontSize,
              padding: '4px 12px',
              cursor: 'pointer',
            }}
          >
            Retry Live Data
          </button>
        </div>
      )}

      {/* Hero Header — compact to fit in single viewport */}
      <div style={{ padding: '12px 24px 10px', borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{
            color: COLOR.accent.teal,
            fontSize: TYPE.lg.fontSize,
            fontWeight: WEIGHT.bold,
            letterSpacing: '0.06em',
            fontFamily: FONT_FAMILY,
            margin: 0,
            textTransform: 'uppercase',
          }}>
            TRANSPOSOME EXPLORER
          </h1>
          <span style={{
            fontStyle: 'italic',
            fontSize: 11,
            color: COLOR.text.muted,
            fontFamily: FONT_FAMILY,
          }}>
            Mechanics, Age, Awakening
          </span>
        </div>

        {/* Stats bar — inline with header */}
        <div style={{ display: 'flex', gap: SPACE[6], flexWrap: 'wrap', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontFamily: FONT_FAMILY }}>{store.loading ? '\u2014' : store.families.length}</span>
            <span style={{ fontSize: 9, color: COLOR.text.faint, fontFamily: FONT_FAMILY, letterSpacing: '0.04em' }}>families</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontFamily: FONT_FAMILY }}>5.6M</span>
            <span style={{ fontSize: 9, color: COLOR.text.faint, fontFamily: FONT_FAMILY, letterSpacing: '0.04em' }}>elements</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontFamily: FONT_FAMILY }}>{store.loading ? '\u2014' : genomeFraction + '%'}</span>
            <span style={{ fontSize: 9, color: COLOR.text.faint, fontFamily: FONT_FAMILY, letterSpacing: '0.04em' }}>of genome</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: WEIGHT.bold, color: COLOR.text.primary, fontFamily: FONT_FAMILY }}>{store.loading ? '\u2014' : totalProbes.toLocaleString()}</span>
            <span style={{ fontSize: 9, color: COLOR.text.faint, fontFamily: FONT_FAMILY, letterSpacing: '0.04em' }}>EPIC v2 probes</span>
          </div>
        </div>
      </div>

      {/* Mode Tabs */}
      <ModeTabs activeTab="landscape" onTabChange={() => {}} />

      {/* Three-Panel Layout (single column on mobile) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '220px 1fr 300px',
        flex: 1,
        minHeight: isMobile ? undefined : 500,
        overflow: 'hidden',
      }}>
        {/* Left Rail — hidden on mobile */}
        {!isMobile && (
          <div style={{
            borderRight: `1px solid ${COLOR.border.subtle}`,
            background: COLOR.bg.elevated,
            overflowY: 'auto',
            padding: '16px 12px',
          }}>
            <LensPanel />
          </div>
        )}

        {/* Center - Landscape Canvas */}
        <div style={{
          position: 'relative',
          overflow: 'hidden',
          background: COLOR.bg.primary,
          ...(isMobile ? { height: 400 } : {}),
        }}>
          {centerContent}
        </div>

        {/* Right Panel - Family Inspector */}
        <div style={{
          borderLeft: isMobile ? undefined : `1px solid ${COLOR.border.subtle}`,
          borderTop: isMobile ? `1px solid ${COLOR.border.subtle}` : undefined,
          background: COLOR.bg.elevated,
          overflowY: 'auto',
          padding: '16px 14px',
        }}>
          <FamilyInspector />
        </div>
      </div>
    </main>
  );
}
