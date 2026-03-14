'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
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
import { getChromosomeByName } from '@/config/chromosomes';
import { useAnimatedNav } from '@/hooks/useAnimatedNav';
import { usePinchZoom } from '@/hooks/usePinchZoom';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { COLOR, FONT_FAMILY, SPACE, LAYOUT, COMPONENT } from '@/config/theme';

function parseRegionParam(region: string): { chr: string; start: number; end: number } | null {
  const decoded = decodeURIComponent(region);
  const match = decoded.match(/^(chr[0-9XYM]+):(\d+)-(\d+)$/);
  if (!match) return null;
  return { chr: match[1], start: parseInt(match[2], 10), end: parseInt(match[3], 10) };
}

function ViewerPage() {
  const params = useParams<{ build: string; region: string }>();
  const { build, chr, start, end, width, activeLayers, showCodons, showGC, visibleCellTypes, enabledMotifs, setBuild, setRegion, setLayers, toggleLayer, toggleCodons, toggleGC, toggleCellType, toggleMotif, toggleAllProbes, toggleAllCellTypes } = useViewport();
  const { toggleAllMotifs } = useViewport();
  const { data, loading, error } = useViewportData();
  const { animRef, panLeft, panRight, zoomIn, zoomOut } = useAnimatedNav();

  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(1200);
  const [showContext, setShowContext] = useState(true);
  const [copyLabel, setCopyLabel] = useState('Link');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isMobile = useIsMobile();
  const regionContext = useRegionContext(data, chr, start, end);
  usePinchZoom(containerRef);

  useEffect(() => {
    function updateWidth() {
      if (containerRef.current) {
        setCanvasWidth(containerRef.current.clientWidth);
      }
    }
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Sync URL params to viewport
  useEffect(() => {
    if (params.build === 'hg38' || params.build === 'hg37') {
      setBuild(params.build);
    }
    const parsed = parseRegionParam(params.region);
    if (parsed) {
      setRegion(parsed.chr, parsed.start, parsed.end);
    }
  }, [params.build, params.region, setBuild, setRegion]);

  // Restore layers from ?layers= query param on mount
  useEffect(() => {
    const layersParam = searchParams.get('layers');
    if (layersParam) {
      setLayers(layersParam.split(',').filter(Boolean));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep ?layers= query param in sync with activeLayers
  useEffect(() => {
    const newUrl = `${window.location.pathname}?layers=${activeLayers.join(',')}`;
    window.history.replaceState(null, '', newUrl);
  }, [activeLayers]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case 'ArrowLeft':  panLeft();  break;
        case 'ArrowRight': panRight(); break;
        case '+': case '=': zoomIn();  break;
        case '-': case '_': zoomOut(); break;
        case 'i': setShowContext(prev => !prev); break;
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panLeft, panRight, zoomIn, zoomOut]);

  // Click-and-drag panning
  const dragRef = useRef<{ startX: number; viewStart: number; viewEnd: number; chr: string } | null>(null);
  const [dragging, setDragging] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'SELECT' || tag === 'A') return;
    const state = useViewport.getState();
    dragRef.current = { startX: e.clientX, viewStart: state.start, viewEnd: state.end, chr: state.chr };
    setDragging(true);
    e.preventDefault();
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function handleMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;
      const deltaX = e.clientX - drag.startX;
      const trackWidth = containerRef.current.clientWidth;
      const viewWidth = drag.viewEnd - drag.viewStart + 1;
      const bpPerPixel = viewWidth / trackWidth;
      const deltaBp = Math.round(-deltaX * bpPerPixel);
      const newStart = Math.max(1, drag.viewStart + deltaBp);
      const newEnd = newStart + viewWidth - 1;
      useViewport.getState().setRegion(drag.chr, newStart, newEnd);
    }
    function handleMouseUp() {
      dragRef.current = null;
      setDragging(false);
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragging]);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopyLabel('Copied!');
      setTimeout(() => setCopyLabel('Link'), 2000);
    }).catch(() => {});
  }

  function handleNavigate(c: string, s: number, e: number) {
    setRegion(c, s, e);
  }

  function handleSelectChromosome(chrName: string) {
    const info = getChromosomeByName(chrName);
    if (info) {
      const center = Math.round(info.length / 2);
      const halfView = Math.min(50_000, Math.round(info.length / 2));
      setRegion(chrName, Math.max(1, center - halfView), center + halfView);
    }
  }

  function handleZoomPreset(targetWidth: number) {
    const center = (start + end) / 2;
    setRegion(chr, Math.max(1, Math.round(center - targetWidth / 2)), Math.round(center + targetWidth / 2));
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: COLOR.bg.primary }}>

      <BrandBar onToggleSidebar={() => setMobileSidebarOpen(v => !v)} />

      {/* ─── Navigation Bar: Build | Coordinates | Search ─── */}
      <div className="flex items-center" style={{ backgroundColor: COLOR.bg.primary }}>
        <div className="flex-1">
          <HeaderBar
            build={build}
            chr={chr}
            start={start}
            end={end}
            onNavigate={handleNavigate}
            onBuildChange={setBuild}
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
            <ExportButton targetRef={exportRef} region={`${chr}:${start}-${end}`} build={build} />
          </div>
        )}
      </div>

      <IdeogramBar
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
          className="flex-1 overflow-hidden flex flex-col select-none"
          style={{ cursor: dragging ? 'grabbing' : 'grab' }}
          onMouseDown={handleMouseDown}
        >
          {/* Loading progress bar — subtle teal line at top */}
          {loading && (
            <div style={{
              position: 'sticky',
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

          <div ref={(el) => { (animRef as React.MutableRefObject<HTMLDivElement | null>).current = el; exportRef.current = el; }} className="flex flex-col flex-1 overflow-hidden" style={{ transformOrigin: 'center center', willChange: 'transform' }}>
            <div style={{ backgroundColor: COLOR.bg.primary, borderBottom: `1px solid ${COLOR.border.subtle}` }}>
              <CoordinateRuler
                viewStart={start}
                viewEnd={end}
                canvasWidth={Math.max(100, canvasWidth)}
              />
            </div>

            <div className="flex-1 overflow-y-auto">
              <TrackStack
                data={data}
                viewStart={start}
                viewEnd={end}
                canvasWidth={canvasWidth}
                loading={loading}
                error={error}
                showCodons={showCodons}
                showGC={showGC}
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
