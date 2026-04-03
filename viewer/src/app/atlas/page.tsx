'use client';

import { useState, useEffect, useCallback } from 'react';
import { CHROMOSOMES, getChromosomeByName } from '@/config/chromosomes';
import { fetchAggregation, fetchLayerSummary, AggregationResponse, LayerSummary } from '@/lib/api';
import { BrandBar } from '@/components/BrandBar';
import { KaryotypeOverview } from '@/components/atlas/KaryotypeOverview';
import { ChromosomeDetail } from '@/components/atlas/ChromosomeDetail';
import { GeneSearch } from '@/components/atlas/GeneSearch';
import { GeneProfile } from '@/components/atlas/GeneProfile';
import { Footer } from '@/components/Footer';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { COLOR, FONT_FAMILY, TYPE, SPACE } from '@/config/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUILD = 'hg38';
const LAYERS = ['gencode_v44', 'cpg_sites', 'probe_epic_v2'] as const;
const AGG_RESOLUTION = 1_000_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ViewState =
  | 'overview'
  | 'entering'
  | 'detail'
  | 'exiting'
  | 'gene_entering'
  | 'gene'
  | 'gene_exiting';

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

function readUrlParams(): { chr: string | null; gene: string | null } {
  if (typeof window === 'undefined') return { chr: null, gene: null };
  const params = new URLSearchParams(window.location.search);
  return {
    chr: params.get('chr') || null,
    gene: params.get('gene') || null,
  };
}

function createInitialChrStats(): Record<string, ChrStats> {
  const init: Record<string, ChrStats> = {};
  for (const chr of CHROMOSOMES) {
    init[chr.name] = { genes: null, cpgIslands: null, probes: null, loaded: false };
  }
  return init;
}

async function runWithConcurrency(
  tasks: Array<() => Promise<void>>,
  limit: number,
): Promise<void> {
  const queue = [...tasks];
  const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) return;
      await task();
    }
  });
  await Promise.allSettled(workers);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AtlasPage() {
  const [selectedChr, setSelectedChr] = useState<string | null>(null);
  const [selectedGene, setSelectedGene] = useState<string | null>(null);
  const [viewState, setViewState] = useState<ViewState>('overview');
  const [hydrated, setHydrated] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [statsReloadKey, setStatsReloadKey] = useState(0);

  // Read URL params after mount
  useEffect(() => {
    const { chr, gene } = readUrlParams();
    if (gene) {
      setSelectedGene(gene.toUpperCase());
      setViewState('gene');
    } else if (chr) {
      setSelectedChr(chr);
      setViewState('detail');
    }
    setHydrated(true);
  }, []);

  const [chrStats, setChrStats] = useState<Record<string, ChrStats>>(createInitialChrStats);

  // Authoritative counts from the layers summary endpoint
  const [layerSummary, setLayerSummary] = useState<LayerSummary | null>(null);

  useEffect(() => {
    setSummaryError(null);
    fetchLayerSummary(BUILD)
      .then(setLayerSummary)
      .catch((err: unknown) => {
        setLayerSummary(null);
        setSummaryError(err instanceof Error ? err.message : 'Layer summary unavailable.');
      });
  }, [statsReloadKey]);

  // Load aggregation data for all chromosomes
  useEffect(() => {
    let cancelled = false;
    setChrStats(createInitialChrStats());

    async function loadAll() {
      // Stats tasks (original 3 layers)
      const statsTasks = CHROMOSOMES.map((chr) => async () => {
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
              cpgIslands: sumBinCounts(agg, 'cpg_sites'),
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

      await runWithConcurrency(statsTasks, 4);
    }

    loadAll();
    return () => { cancelled = true; };
  }, [statsReloadKey]);

  // URL sync
  useEffect(() => {
    if (!hydrated) return;
    const url = new URL(window.location.href);
    if (selectedGene) {
      url.searchParams.delete('chr');
      url.searchParams.set('gene', selectedGene);
    } else if (selectedChr) {
      url.searchParams.delete('gene');
      url.searchParams.set('chr', selectedChr);
    } else {
      url.searchParams.delete('chr');
      url.searchParams.delete('gene');
    }
    history.replaceState(null, '', url.toString());
  }, [selectedChr, selectedGene, hydrated]);

  // Handle browser back/forward
  useEffect(() => {
    function onPopState() {
      const { chr, gene } = readUrlParams();
      if (gene) {
        setSelectedGene(gene.toUpperCase());
        setSelectedChr(null);
        setViewState('gene');
      } else if (chr) {
        setSelectedChr(chr);
        setSelectedGene(null);
        setViewState('detail');
      } else {
        setSelectedChr(null);
        setSelectedGene(null);
        setViewState('overview');
      }
    }
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const selectChromosome = useCallback((chrName: string) => {
    setSelectedGene(null);
    setSelectedChr(chrName);
    setViewState('entering');
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

  const selectGene = useCallback((symbol: string) => {
    const upper = symbol.toUpperCase();
    // If currently in chr detail, exit first then enter gene
    if (viewState === 'detail' || viewState === 'entering') {
      setViewState('exiting');
      setTimeout(() => {
        setSelectedChr(null);
        setSelectedGene(upper);
        setViewState('gene_entering');
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setViewState('gene');
          });
        });
      }, 300);
    } else {
      setSelectedChr(null);
      setSelectedGene(upper);
      setViewState('gene_entering');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setViewState('gene');
        });
      });
    }
  }, [viewState]);

  const goBackFromGene = useCallback(() => {
    setViewState('gene_exiting');
    setTimeout(() => {
      setSelectedGene(null);
      setViewState('overview');
    }, 300);
  }, []);

  const [aggBannerDismissed, setAggBannerDismissed] = useState(false);
  const anyFailed = Object.entries(chrStats).some(([name, s]) => name !== 'chrM' && s.loaded && s.genes === null);
  const failedCount = Object.entries(chrStats).filter(([name, s]) => name !== 'chrM' && s.loaded && s.genes === null).length;

  const chrInfo = selectedChr ? getChromosomeByName(selectedChr) : null;
  const stats = selectedChr ? chrStats[selectedChr] : null;

  const showDetail = viewState === 'entering' || viewState === 'detail' || viewState === 'exiting';
  const showOverview = viewState === 'overview' || viewState === 'exiting';
  const showGene = viewState === 'gene_entering' || viewState === 'gene' || viewState === 'gene_exiting';

  // Dynamic subtitle
  const subtitle = selectedGene
    ? `Gene Profile · ${selectedGene} · hg38`
    : 'Karyotype Atlas · hg38';

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      fontFamily: FONT_FAMILY,
    }}>
      <BrandBar subtitle={subtitle} sticky />

      <GeneSearch
        build={BUILD}
        onSelectGene={selectGene}
        selectedGene={selectedGene}
        onClear={goBackFromGene}
      />

      {(anyFailed || summaryError) && !aggBannerDismissed && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACE[3],
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
        }}>
          <span style={{
            color: COLOR.text.muted,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
          }}>
            {failedCount > 0
              ? `Chromosome statistics unavailable for ${failedCount} chromosome${failedCount === 1 ? '' : 's'}.`
              : 'Chromosome statistics temporarily unavailable.'}
            {summaryError ? ' Layer summary also failed to load.' : ''}
          </span>
          <button
            onClick={() => {
              setAggBannerDismissed(false);
              setStatsReloadKey((v) => v + 1);
            }}
            style={{
              background: 'none',
              border: `1px solid ${COLOR.border.strong}`,
              color: COLOR.text.secondary,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              cursor: 'pointer',
              padding: `2px ${SPACE[2]}px`,
            }}
          >
            Retry
          </button>
          <button
            onClick={() => setAggBannerDismissed(true)}
            style={{
              background: 'none',
              border: 'none',
              color: COLOR.text.muted,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
              cursor: 'pointer',
              padding: `0 ${SPACE[1]}px`,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Overview */}
      {showOverview && (
        <div style={{
          opacity: viewState === 'overview' ? 1 : 0,
          transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <ErrorBoundary fallbackLabel="Karyotype Overview">
            <KaryotypeOverview onSelectChromosome={selectChromosome} chrStats={chrStats} layerSummary={layerSummary} />
          </ErrorBoundary>
        </div>
      )}

      {/* Chromosome Detail */}
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

      {/* Gene Profile */}
      {showGene && selectedGene && (
        <div style={{
          opacity: viewState === 'gene' ? 1 : 0,
          transform: viewState === 'gene' ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1), transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        }}>
          <ErrorBoundary fallbackLabel="Gene Profile">
            <GeneProfile
              symbol={selectedGene}
              build={BUILD}
              onBack={goBackFromGene}
            />
          </ErrorBoundary>
        </div>
      )}
      <Footer />
    </main>
  );
}
