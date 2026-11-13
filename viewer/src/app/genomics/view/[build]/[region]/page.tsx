'use client';

import { useEffect, useLayoutEffect, useState, useRef, useCallback, Suspense } from 'react';
import { TRACK_LABEL_WIDTH } from '@/config/viewerLayout';
import { useViewerUrl } from '@/hooks/useViewerUrl';
import { useLocusRequest } from '@/hooks/useLocusRequest';
import { boundedRegion, contigLength, validRegion, type GenomeBuild } from '@/lib/reference';
import { useViewport } from '@/stores/viewport';
import { useViewportData } from '@/hooks/useViewportData';
import { TrackStack } from '@/components/TrackStack';
import { HeaderBar } from '@/components/HeaderBar';
import { IdeogramBar } from '@/components/IdeogramBar';
import { Sidebar } from '@/components/Sidebar';
import { BrandBar } from '@/components/BrandBar';
import { CoordinateRuler } from '@/components/CoordinateRuler';
import { RegionContextPanel } from '@/components/RegionContextPanel';
import { ExportButton } from '@/components/ExportButton';
import { Footer } from '@/components/Footer';
import { useRegionContext } from '@/hooks/useRegionContext';
import { useAnimatedNav } from '@/hooks/useAnimatedNav';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, LAYOUT, TYPE, WEIGHT } from '@/config/theme';
import { fetchBiophysicsCompute } from '@/lib/api';

function ViewerPage() {
  const { ready, error: routeError } = useViewerUrl();
  const { build, chr, start, end, width, activeLayers, showCodons, showGC, showStability, showStructure, showMotifs, visibleCellTypes, enabledMotifs, setBuild, setRegion, setLayers, toggleLayer, toggleCodons, toggleGC, toggleStability, toggleStructure, toggleMotifs, toggleCellType, toggleMotif, toggleAllProbes, toggleAllCellTypes } = useViewport();
  const { toggleAllMotifs } = useViewport();
  const { data, loading, error } = useViewportData(ready);
  const { animRef, panLeft, panRight, zoomIn, zoomOut } = useAnimatedNav();

  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const trackScrollRef = useRef<HTMLDivElement>(null);
  const scrollAnchor = useRef<{ id: string; offset: number; top: number } | null>(null);
  const restoringScroll = useRef(false);
  const rememberTrackScroll = () => {
    const pane = trackScrollRef.current;
    if (!pane || restoringScroll.current) return;
    const top = pane.getBoundingClientRect().top;
    const rows = Array.from(pane.querySelectorAll<HTMLElement>('[data-track-id]'));
    const row = rows.find(el => el.getBoundingClientRect().bottom > top);
    if (row) scrollAnchor.current = { id: row.dataset.trackId!, offset: row.getBoundingClientRect().top - top, top: pane.scrollTop };
  };
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const showContext = useViewport(state => state.showContext);
  const [pendingBuild, setPendingBuild] = useState<GenomeBuild | null>(null);
  const [copyLabel, setCopyLabel] = useState('Link');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const dragRef = useRef<{ startX: number; viewStart: number; viewEnd: number; chr: string; lastClientX: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragOffsetRef = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const plotWidth = Math.max(1, canvasWidth - TRACK_LABEL_WIDTH);
  const activeDrag = dragRef.current;
  const dragBp = activeDrag ? Math.round(-dragOffsetPx * (activeDrag.viewEnd - activeDrag.viewStart + 1) / plotWidth) : 0;
  const previewRegion = dragging && activeDrag
    ? boundedRegion(build, activeDrag.chr, activeDrag.viewStart + dragBp, activeDrag.viewEnd + dragBp)
    : null;
  const displayStart = previewRegion?.start ?? start;
  const displayEnd = previewRegion?.end ?? end;
  const regionContext = useRegionContext(data, chr, displayStart, displayEnd);

  const properties = [showStability ? 'thermodynamics,contextual' : '', showStructure ? 'curvature,structural' : '', showMotifs ? 'motifs' : ''].filter(Boolean).join(',');
  const computeKey = ready && width <= 1_000_000 && properties ? JSON.stringify([build, chr, start, end, properties]) : null;
  const { data: biophysicsData, loading: computeLoading, error: computeError } = useLocusRequest(computeKey,
    signal => fetchBiophysicsCompute(build, `${chr}:${start}-${end}`, properties, signal), 25, response => response.data.n_steps <= 100_000);
  // Preserve the last drag frame while the committed interval finishes loading.
  // Features retain their genomic coordinates; this fallback is scoped to this
  // release target and is never reused by a later navigation or assembly change.
  const releaseFrame = useRef<{ key: string; data: typeof data; compute: typeof biophysicsData } | null>(null);
  const frameKey = JSON.stringify([build, chr, start, end, activeLayers, properties]);
  const latestFrame = useRef({ data, compute: biophysicsData });
  const released = releaseFrame.current?.key === frameKey ? releaseFrame.current : null;
  const renderedData = data ?? (loading ? released?.data ?? null : null);
  const renderedCompute = biophysicsData ?? (computeLoading ? released?.compute ?? null : null);
  latestFrame.current = { data: renderedData, compute: renderedCompute };
  usePinchZoom(containerRef, ready);
  useLayoutEffect(() => {
    const pane = trackScrollRef.current, anchor = scrollAnchor.current;
    if (!pane || !anchor) return;
    const row = Array.from(pane.querySelectorAll<HTMLElement>('[data-track-id]')).find(el => el.dataset.trackId === anchor.id);
    restoringScroll.current = true;
    pane.scrollTop = row ? pane.scrollTop + row.getBoundingClientRect().top - pane.getBoundingClientRect().top - anchor.offset : anchor.top;
    requestAnimationFrame(() => { restoringScroll.current = false; });
  }, [data, loading, computeLoading, biophysicsData, computeError]);

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.clientWidth);
      }
    }
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    if (containerRef.current) observer.observe(containerRef.current);
    window.addEventListener('resize', updateWidth);
    return () => { observer.disconnect(); window.removeEventListener('resize', updateWidth); };
  }, [ready]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && (e.target.closest('input, textarea, select, button, a, [contenteditable=true]'))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key) {
        case 'ArrowLeft':  panLeft();  break;
        case 'ArrowRight': panRight(); break;
        case '+': case '=': zoomIn();  break;
        case '-': case '_': zoomOut(); break;
        case 'i': useViewport.setState(state => ({ showContext: !state.showContext })); break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panLeft, panRight, zoomIn, zoomOut]);

  // Redraw against buffered genomic data during drag; commit the URL/history once on release.
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || (containerRef.current && e.clientX < containerRef.current.getBoundingClientRect().left + TRACK_LABEL_WIDTH)) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'A') return;
    const state = useViewport.getState();
    dragRef.current = { startX: e.clientX, viewStart: state.start, viewEnd: state.end, chr: state.chr, lastClientX: e.clientX };
    pendingDragOffsetRef.current = 0;
    setDragging(true);
    setDragOffsetPx(0);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function handleMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      drag.lastClientX = e.clientX;
      pendingDragOffsetRef.current = e.clientX - drag.startX;
      if (dragRafRef.current == null) {
        dragRafRef.current = requestAnimationFrame(() => {
          dragRafRef.current = null;
          setDragOffsetPx(pendingDragOffsetRef.current);
        });
      }
    }
    function handleMouseUp(e: MouseEvent) {
      const drag = dragRef.current;
      if (drag && containerRef.current) {
        const deltaX = e.clientX - drag.startX;
        const trackWidth = Math.max(1, containerRef.current.clientWidth - TRACK_LABEL_WIDTH);
        const viewWidth = drag.viewEnd - drag.viewStart + 1;
        const bpPerPixel = viewWidth / trackWidth;
        const deltaBp = Math.round(-deltaX * bpPerPixel);
        const newStart = Math.max(1, drag.viewStart + deltaBp);
        const newEnd = newStart + viewWidth - 1;
        const state = useViewport.getState();
        const target = boundedRegion(state.build, drag.chr, newStart, newEnd);
        if (target) releaseFrame.current = {
          key: JSON.stringify([state.build, drag.chr, target.start, target.end, state.activeLayers, properties]),
          ...latestFrame.current,
        };
        state.setRegion(drag.chr, newStart, newEnd);
      }
      if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
      pendingDragOffsetRef.current = 0;
      dragRef.current = null;
      setDragging(false);
      setDragOffsetPx(0);
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (dragRafRef.current != null) cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    };
  }, [dragging]);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Link'), 2000);
    }).catch(() => {
      setCopyLabel('Copy failed');
      setTimeout(() => setCopyLabel('Link'), 2000);
    });
  }

  function handleNavigate(c: string, s: number, e: number) {
    setRegion(c, s, e);
  }

  function handleSelectChromosome(chrName: string) {
    const length = contigLength(build, chrName);
    const info = length ? { length } : undefined;
    if (info) {
      const center = Math.round(info.length / 2);
      const halfView = Math.min(50_000, Math.round(info.length / 2));
      setRegion(chrName, Math.max(1, center - halfView), center + halfView);
    }
  }

  function handleZoomPreset(targetWidth: number) {
    const center = (start + end) / 2;
    const nextStart = Math.round(center - (targetWidth - 1) / 2);
    setRegion(chr, nextStart, nextStart + targetWidth - 1);
  }

  if (routeError) return <main style={{ padding: 32 }}><BrandBar /><h1>Unable to open this region</h1><p role="alert">{routeError}</p><a href="/">Return to genome search</a></main>;
  if (!ready) return <p role="status">Opening genome viewer…</p>;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: COLOR.bg.primary }}>

      <BrandBar
        sticky
        onToggleSidebar={() => setMobileSidebarOpen(v => !v)}
        subtitle={
          <span style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: SPACE[3],
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.sm.fontSize,
            letterSpacing: '0.04em',
          }}>
            <span style={{ color: COLOR.text.tertiary }}>
              {chr}:{start.toLocaleString()}-{end.toLocaleString()}
            </span>
            <span style={{ color: COLOR.border.strong }}>·</span>
            <span style={{ color: COLOR.text.tertiary }}>{build}</span>
            {regionContext?.gene?.geneSymbol && (
              <>
                <span style={{ color: COLOR.border.strong }}>·</span>
                <span style={{
                  color: COLOR.primary.base,
                  fontWeight: WEIGHT.semibold,
                  letterSpacing: '0.08em',
                }}>
                  {regionContext.gene.geneSymbol}
                </span>
              </>
            )}
          </span>
        }
      />

      {/* ─── Navigation Bar: Build | Coordinates | Search ─── */}
      <div className="flex items-center" style={{ backgroundColor: COLOR.bg.primary }}>
        <div className="flex-1">
          <HeaderBar
            build={build}
            chr={chr}
            start={start}
            end={end}
            onNavigate={handleNavigate}
            onBuildChange={next => { if (next !== build) setPendingBuild(next); }}
            copyLinkLabel={copyLabel}
            onCopyLink={handleCopyLink}
            onPanLeft={panLeft}
            onPanRight={panRight}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onZoomPreset={handleZoomPreset}
            viewportWidth={width}
          />
        </div>
        {!isMobile && (
          <div style={{ paddingRight: 12, flexShrink: 0 }}>
            <ExportButton targetRef={exportRef} region={`${chr}:${start}-${end}`} build={build} disabled={!ready || loading || computeLoading || !!error} layers={data?.layersResolved} />
          </div>
        )}
      </div>

      {pendingBuild && <div role="region" aria-label="Confirm assembly change" style={{ padding: 12, background: COLOR.bg.elevated, fontSize: 13 }}>
        <p>Open the same numeric coordinates in {pendingBuild === 'hg38' ? 'GRCh38 / hg38' : 'GRCh37 / hg19'}? This does not convert the locus between assemblies. Annotation coverage may differ.</p>
        {!validRegion(pendingBuild, chr, start, end) && <p role="alert">This interval is outside the destination chromosome. Search for a valid region in that assembly instead.</p>}
        <button type="button" disabled={!validRegion(pendingBuild, chr, start, end)} onClick={() => { setBuild(pendingBuild); setPendingBuild(null); }}>Use same numeric coordinates</button>{' '}
        <button type="button" onClick={() => setPendingBuild(null)}>Cancel</button>
      </div>}
      <IdeogramBar
        build={build}
        currentChromosome={chr}
        onSelectChromosome={handleSelectChromosome}
        viewStart={start}
        viewEnd={end}
        onNavigate={handleNavigate}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile sidebar overlay */}
        {isMobile && mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 199,
            }}
          />
        )}
        <div style={isMobile ? {
          position: 'fixed',
          left: mobileSidebarOpen ? 0 : -LAYOUT.sidebarWidth,
          top: 44,
          bottom: 0,
          zIndex: 200,
          transition: 'left 0.2s ease',
          width: LAYOUT.sidebarWidth,
        } : {}}>
        <Sidebar
          build={build}
          activeLayers={activeLayers}
          onToggleLayer={toggleLayer}
          viewportWidth={width}
          resolution={data?.resolution ?? null}
          showCodons={showCodons}
          onToggleCodons={toggleCodons}
          showGC={showGC}
          onToggleGC={toggleGC}
          showStability={showStability}
          onToggleStability={toggleStability}
          showStructure={showStructure}
          onToggleStructure={toggleStructure}
          showMotifs={showMotifs}
          onToggleMotifs={toggleMotifs}
          visibleCellTypes={visibleCellTypes}
          onToggleCellType={toggleCellType}
          enabledMotifs={enabledMotifs}
          onToggleMotif={toggleMotif}
          onToggleAllProbes={toggleAllProbes}
          onToggleAllCellTypes={toggleAllCellTypes}
          onToggleAllMotifs={toggleAllMotifs}
        />
        </div>

        <main
          ref={containerRef}
          className="relative flex-1 overflow-hidden flex flex-col select-none"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
        >
          {/* Loading progress bar — subtle teal line at top */}
          {loading && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 2,
              zIndex: 10,
              flexShrink: 0,
              overflow: 'hidden',
              backgroundColor: COLOR.border.subtle,
            }}>
              <div style={{
                height: '100%',
                width: '40%',
                backgroundColor: COLOR.accent.teal,
                animation: 'progressSlide 1.2s ease-in-out infinite',
              }} />
            </div>
          )}

          <div ref={(el) => { (animRef as React.MutableRefObject<HTMLDivElement | null>).current = el; exportRef.current = el; }} className="flex flex-col flex-1 overflow-hidden">
            <div data-testid="viewer-ruler" style={{ paddingLeft: TRACK_LABEL_WIDTH, backgroundColor: COLOR.bg.primary, borderBottom: `1px solid ${COLOR.border.subtle}` }}>
              <CoordinateRuler
                viewStart={displayStart}
                viewEnd={displayEnd}
                canvasWidth={Math.max(100, canvasWidth - TRACK_LABEL_WIDTH)}
              />
            </div>

            <div ref={trackScrollRef} onScroll={rememberTrackScroll} data-testid="viewer-track-scroll" className="viewer-track-scroll flex-1 overflow-y-auto">
              <TrackStack
                data={renderedData}
                viewStart={displayStart}
                viewEnd={displayEnd}
                canvasWidth={canvasWidth}
                loading={loading}
                error={error}
                showCodons={showCodons}
                showGC={showGC}
                showStability={showStability}
                showStructure={showStructure}
                showMotifs={showMotifs}
                biophysicsData={renderedCompute ?? undefined}
                computeLoading={computeLoading}
                computeError={computeError}
                visibleCellTypes={visibleCellTypes}
                enabledMotifs={enabledMotifs}
              />
            </div>
          </div>
        </main>

        {showContext && !isMobile && <RegionContextPanel context={regionContext} activeLayers={activeLayers} />}
      </div>

      <Footer />

      {/* Progress bar animation */}
      <style>{`
        @keyframes progressSlide {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}

export default function ViewerPageWrapper() {
  return (
    <Suspense fallback={null}>
      <ViewerPage />
    </Suspense>
  );
}
