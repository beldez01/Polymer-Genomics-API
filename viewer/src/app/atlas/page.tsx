'use client';

import { useState, useEffect, useCallback } from 'react';
import { CHROMOSOMES, getChromosomeByName } from '@/config/chromosomes';
import { fetchAggregation, AggregationResponse } from '@/lib/api';
import { BrandBar } from '@/components/BrandBar';
import { KaryotypeOverview } from '@/components/atlas/KaryotypeOverview';
import { ChromosomeDetail } from '@/components/atlas/ChromosomeDetail';
import { COLOR, FONT_FAMILY } from '@/config/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUILD = 'hg38';
const LAYERS = ['gencode_v44', 'cpg_islands', 'probe_epic_v2'] as const;
const AGG_RESOLUTION = 1_000_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChrStats {
  genes: number | null;
  cpgIslands: number | null;
  probes: number | null;
  loaded: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumBinCounts(agg: AggregationResponse, layer: string): number {
  const layerData = agg.data[layer];
  if (!layerData) return 0;
  return layerData.bins.reduce((s, b) => s + b.count, 0);
}

function readChrParam(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('chr') || null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AtlasPage() {
  // Initialize as null (SSR-safe), then hydrate from URL in useEffect
  const [selectedChr, setSelectedChr] = useState<string | null>(null);
  const [viewState, setViewState] = useState<'overview' | 'entering' | 'detail' | 'exiting'>('overview');
  const [hydrated, setHydrated] = useState(false);

  // Read URL param after mount to avoid hydration mismatch
  useEffect(() => {
    const chr = readChrParam();
    if (chr) {
      setSelectedChr(chr);
      setViewState('detail');
    }
    setHydrated(true);
  }, []);

  const [chrStats, setChrStats] = useState<Record<string, ChrStats>>(() => {
    const init: Record<string, ChrStats> = {};
    for (const chr of CHROMOSOMES) {
      init[chr.name] = { genes: null, cpgIslands: null, probes: null, loaded: false };
    }
    return init;
  });

  // Load aggregation data for all chromosomes
  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      const promises = CHROMOSOMES.map(async (chr) => {
        if (chr.name === 'chrM') {
          if (!cancelled) {
            setChrStats(prev => ({
              ...prev,
              [chr.name]: { genes: null, cpgIslands: null, probes: null, loaded: true },
            }));
          }
          return;
        }

        try {
          const region = `${chr.name}:1-${chr.length}`;
          const agg = await fetchAggregation(BUILD, region, AGG_RESOLUTION, [...LAYERS]);
          if (cancelled) return;

          setChrStats(prev => ({
            ...prev,
            [chr.name]: {
              genes: sumBinCounts(agg, 'gencode_v44'),
              cpgIslands: sumBinCounts(agg, 'cpg_islands'),
              probes: sumBinCounts(agg, 'probe_epic_v2'),
              loaded: true,
            },
          }));
        } catch {
          if (!cancelled) {
            setChrStats(prev => ({
              ...prev,
              [chr.name]: { genes: null, cpgIslands: null, probes: null, loaded: true },
            }));
          }
        }
      });

      await Promise.allSettled(promises);
    }

    loadAll();
    return () => { cancelled = true; };
  }, []);

  // URL sync (skip before hydration to avoid clobbering the initial ?chr param)
  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    if (selectedChr) {
      url.searchParams.set('chr', selectedChr);
    } else {
      url.searchParams.delete('chr');
    }
    history.replaceState(null, '', url.toString());
  }, [selectedChr, hydrated]);

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      const chr = readChrParam();
      setSelectedChr(chr);
      setViewState(chr ? 'detail' : 'overview');
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectChromosome = useCallback((chrName: string) => {
    setSelectedChr(chrName);
    setViewState('entering');
    // Trigger enter animation
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setViewState('detail');
      });
    });
  }, []);

  const goBack = useCallback(() => {
    setViewState('exiting');
    setTimeout(() => {
      setSelectedChr(null);
      setViewState('overview');
    }, 300);
  }, []);

  const chrInfo = selectedChr ? getChromosomeByName(selectedChr) : null;
  const stats = selectedChr ? chrStats[selectedChr] : null;

  const showDetail = viewState === 'entering' || viewState === 'detail' || viewState === 'exiting';
  const showOverview = viewState === 'overview' || viewState === 'exiting';

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      fontFamily: FONT_FAMILY,
    }}>
      <BrandBar subtitle="Karyotype Atlas · hg38" sticky />

      {/* Overview */}
      {showOverview && (
        <div style={{
          opacity: viewState === 'overview' ? 1 : 0,
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <KaryotypeOverview onSelectChromosome={selectChromosome} />
        </div>
      )}

      {/* Detail */}
      {showDetail && chrInfo && (
        <div style={{
          opacity: viewState === 'detail' ? 1 : 0,
          transform: viewState === 'detail' ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <ChromosomeDetail
            chr={chrInfo}
            geneCount={stats?.genes ?? null}
            cpgIslandCount={stats?.cpgIslands ?? null}
            probeCount={stats?.probes ?? null}
            onBack={goBack}
          />
        </div>
      )}
    </main>
  );
}
