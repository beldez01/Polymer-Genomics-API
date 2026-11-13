'use client';

import type { LayerResolved } from '@/lib/api';
import { useState } from 'react';
import { COLOR, FONT_FAMILY, TYPE, COMPONENT } from '@/config/theme';

interface ExportButtonProps {
  targetRef: React.RefObject<HTMLElement | null>;
  region?: string;
  build?: string;
  disabled?: boolean;
  layers?: LayerResolved[];
}

export function ExportButton({ targetRef, region, build, disabled, layers = [] }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [failure, setFailure] = useState('');
  const [hover, setHover] = useState(false);

  const handleExport = async () => {
    if (!targetRef.current || exporting || disabled) return;
    setFailure('');
    setExporting(true);

    try {
      await document.fonts.ready;
      const { toCanvas } = await import('html-to-image');
      const canvas = await toCanvas(targetRef.current, {
        backgroundColor: COLOR.bg.primary, pixelRatio: 2,
        // Use system fallbacks rather than fetching cross-origin font stylesheets.
        skipFonts: true,
      });

      // Add legend footer
      const legendHeight = 52 + layers.length * 16;
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
      ctx.fillText(legendText, 24, canvas.height + 30);
      ctx.font = '18px monospace';
      ctx.fillText('1-based inclusive · Visible viewport · Reference annotations / sequence-derived models', 24, canvas.height + 58);
      layers.forEach((layer, i) => ctx.fillText(`${layer.layer_key} · ${layer.version}${layer.evidence_class ? ' · Evidence ' + layer.evidence_class : ''}`, 24, canvas.height + 90 + i * 32));

      // Separator line
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, canvas.height, finalCanvas.width, 2);

      // Download
      const blob = await new Promise<Blob>((resolve, reject) => finalCanvas.toBlob(value => value ? resolve(value) : reject(new Error('Image encoding failed')), 'image/png'));
      {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = timestamp.replace(/-/g, '');
        const safeRegion = (region ?? 'viewport').replace(/[:/]/g, '_');
        a.download = `polymer_${build ?? 'hg38'}_${safeRegion}_${ts}.png`;
        a.href = url;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
    } catch (err) {
      console.error('Export failed:', err);
      setFailure('PNG export failed. Try again after data loads.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
    <button type="button"
      onClick={handleExport}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={exporting || disabled}
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
    {failure && <span role="alert" style={{ color: COLOR.accent.rose, fontSize: 12 }}>{failure}</span>}
    </span>
  );
}
