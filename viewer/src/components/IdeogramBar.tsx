'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { CHROMOSOMES, GENOME_LENGTH } from '@/config/chromosomes';
import { useIsMobile } from '@/hooks/useBreakpoint';
import { COLOR, FONT_FAMILY, COMPONENT } from '@/config/theme';

interface IdeogramBarProps {
  currentChromosome: string;
  onSelectChromosome: (chr: string) => void;
  /** Current viewport start (1-based) */
  viewStart?: number;
  /** Current viewport end (1-based) */
  viewEnd?: number;
  /** Navigate to new region on minimap drag */
  onNavigate?: (chr: string, start: number, end: number) => void;
}

function MinimapOverlay({ chrName, chrLength, viewStart, viewEnd, onNavigate, buttonEl }: {
  chrName: string;
  chrLength: number;
  viewStart: number;
  viewEnd: number;
  onNavigate: (chr: string, start: number, end: number) => void;
  buttonEl: HTMLButtonElement | null;
}) {
  const [btnWidth, setBtnWidth] = useState(0);
  const dragRef = useRef<{ startX: number; startFrac: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!buttonEl) return;
    const ro = new ResizeObserver(([entry]) => setBtnWidth(entry.contentRect.width));
    ro.observe(buttonEl);
    setBtnWidth(buttonEl.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, [buttonEl]);

  const viewWidth = viewEnd - viewStart + 1;
  const fracLeft = viewStart / chrLength;
  const fracWidth = viewWidth / chrLength;
  const pxLeft = fracLeft * btnWidth;
  const pxWidth = Math.max(4, fracWidth * btnWidth);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = buttonEl?.getBoundingClientRect();
    if (!rect) return;
    dragRef.current = { startX: e.clientX, startFrac: fracLeft };
    setDragging(true);
  }, [buttonEl, fracLeft]);

  useEffect(() => {
    if (!dragging || !buttonEl) return;
    function handleMouseMove(e: MouseEvent) {
      const drag = dragRef.current;
      if (!drag || !buttonEl) return;
      const rect = buttonEl.getBoundingClientRect();
      const deltaX = e.clientX - drag.startX;
      const deltaFrac = deltaX / rect.width;
      const newFracLeft = Math.max(0, Math.min(1 - fracWidth, drag.startFrac + deltaFrac));
      const newStart = Math.max(1, Math.round(newFracLeft * chrLength));
      const newEnd = Math.min(chrLength, newStart + viewWidth - 1);
      onNavigate(chrName, newStart, newEnd);
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
  }, [dragging, buttonEl, chrName, chrLength, viewWidth, fracWidth, onNavigate]);

  if (btnWidth === 0) return null;

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        position: 'absolute',
        top: 0,
        left: pxLeft,
        width: pxWidth,
        height: '100%',
        backgroundColor: 'rgba(15, 98, 254, 0.18)',
        border: `1px solid ${COLOR.primary.base}`,
        borderRadius: 1,
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: 2,
        boxSizing: 'border-box',
      }}
    />
  );
}

export function IdeogramBar({ currentChromosome, onSelectChromosome, viewStart, viewEnd, onNavigate }: IdeogramBarProps) {
  const isMobile = useIsMobile();
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (isMobile) {
    return (
      <div className="w-full flex items-center flex-shrink-0"
           style={{ height: 32, backgroundColor: COLOR.bg.primary, borderBottom: `1px solid ${COLOR.border.subtle}`, padding: '4px 8px' }}>
        <select
          value={currentChromosome}
          onChange={(e) => onSelectChromosome(e.target.value)}
          style={{
            ...COMPONENT.input.default,
            width: '100%',
            height: 24,
            fontSize: 11,
            padding: '0 8px',
          }}
        >
          {CHROMOSOMES.map(chr => (
            <option key={chr.name} value={chr.name}>
              {chr.name} ({(chr.length / 1e6).toFixed(1)} Mb)
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="w-full flex items-stretch flex-shrink-0"
         style={{ height: 32, backgroundColor: COLOR.bg.primary, borderBottom: `1px solid ${COLOR.border.subtle}`, padding: '4px 8px', gap: 2 }}>
      {CHROMOSOMES.map(chr => {
        const pct = (chr.length / GENOME_LENGTH) * 100;
        const isActive = currentChromosome === chr.name;
        const isMito = chr.name === 'chrM';
        const label = chr.name.replace('chr', '');

        return (
          <button key={chr.name}
                  ref={(el) => { buttonRefs.current[chr.name] = el; }}
                  onClick={() => onSelectChromosome(chr.name)}
                  className="chr-btn"
                  title={`${chr.name} (${(chr.length / 1e6).toFixed(1)} Mb)`}
                  style={{
                    flex: isMito ? '0 0 18px' : `${pct} 0 0`,
                    minWidth: isMito ? 18 : 10,
                    backgroundColor: isActive ? `${COLOR.primary.base}14` : COLOR.bg.deep,
                    border: isActive ? `1px solid ${COLOR.primary.base}` : `1px solid ${COLOR.border.strong}`,
                    borderRadius: 999,
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                    transition: 'background-color 0.15s',
                  }}>
            {chr.centromereStart > 0 && (
              <div style={{
                position: 'absolute',
                left: `${(chr.centromereStart / chr.length) * 100}%`,
                width: `${Math.max(((chr.centromereEnd - chr.centromereStart) / chr.length) * 100, 4)}%`,
                height: '100%',
                backgroundColor: COLOR.text.muted,
                opacity: 0.55,
                borderLeft: `1px solid ${COLOR.border.strong}`,
                borderRight: `1px solid ${COLOR.border.strong}`,
              }} />
            )}
            <span style={{
              color: isActive ? COLOR.primary.base : COLOR.text.tertiary,
              fontSize: 9,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: isActive ? 700 : 500,
              position: 'relative', zIndex: 1, pointerEvents: 'none',
              letterSpacing: '-0.02em',
            }}>
              {label}
            </span>
            {isActive && viewStart != null && viewEnd != null && onNavigate && (
              <MinimapOverlay
                chrName={chr.name}
                chrLength={chr.length}
                viewStart={viewStart}
                viewEnd={viewEnd}
                onNavigate={onNavigate}
                buttonEl={buttonRefs.current[chr.name] ?? null}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
