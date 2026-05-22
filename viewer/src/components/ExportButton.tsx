'use client';

import { useState } from 'react';
import { COLOR, FONT_FAMILY, TYPE, COMPONENT } from '@/config/theme';

interface ExportButtonProps {
  targetRef: React.RefObject<HTMLElement | null>;
  region?: string;
  build?: string;
}

export function ExportButton({ targetRef, region, build }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [hover, setHover] = useState(false);

  const handleExport = async () => {
    if (!targetRef.current || exporting) return;
    setExporting(true);

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const html2canvas = (await import(/* webpackIgnore: true */ 'html2canvas' as string)).default as (
        element: HTMLElement, options?: Record<string, unknown>
      ) => Promise<HTMLCanvasElement>;
      const canvas = await html2canvas(targetRef.current, {
        backgroundColor: COLOR.bg.primary,
        scale: 2,
        logging: false,
      });

      // Add legend footer
      const legendHeight = 48;
      const finalCanvas = document.createElement('canvas');
      finalCanvas.width = canvas.width;
      finalCanvas.height = canvas.height + legendHeight * 2; // 2x for retina
      const ctx = finalCanvas.getContext('2d');
      if (!ctx) return;

      // Draw captured content
      ctx.drawImage(canvas, 0, 0);

      // Draw legend background
      ctx.fillStyle = '#F4F4F5';
      ctx.fillRect(0, canvas.height, finalCanvas.width, legendHeight * 2);

      // Draw legend text
      ctx.fillStyle = '#888888';
      ctx.font = `${20}px "JetBrains Mono", "SF Mono", monospace`;
      const timestamp = new Date().toISOString().split('T')[0];
      const legendText = `${build ?? 'hg38'} ${region ?? ''} — ${timestamp} — Polymer Genomics (polymerbio.org)`;
      ctx.fillText(legendText, 24, canvas.height + 36);

      // Separator line
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, canvas.height, finalCanvas.width, 2);

      // Download
      finalCanvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = timestamp.replace(/-/g, '');
        const safeRegion = (region ?? 'viewport').replace(/[:/]/g, '_');
        a.download = `polymer_${build ?? 'hg38'}_${safeRegion}_${ts}.png`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={exporting}
      title="Export viewport as PNG"
      style={{
        ...COMPONENT.button.small,
        ...(hover ? { borderColor: COLOR.accent.teal, color: COLOR.accent.teal } : {}),
        opacity: exporting ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      {/* Download icon (inline SVG) */}
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M8 2v8M4 8l4 4 4-4M2 14h12" />
      </svg>
      {exporting ? 'Exporting...' : 'PNG'}
    </button>
  );
}
