'use client';
import { useRef, useEffect } from 'react';

interface CoordinateRulerProps {
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

function formatPosition(pos: number): string {
  if (pos >= 1_000_000) return `${(pos / 1_000_000).toFixed(2)} Mb`;
  if (pos >= 1_000) return `${(pos / 1_000).toFixed(1)} kb`;
  return pos.toLocaleString();
}

export function CoordinateRuler({
  viewStart,
  viewEnd,
  canvasWidth,
  height = 28,
}: CoordinateRulerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${canvasWidth}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasWidth, height);

    const viewWidth = viewEnd - viewStart + 1;

    // Determine tick spacing (aim for ~80-150px between major ticks)
    const targetPixelGap = 100;
    const bpPerPixel = viewWidth / canvasWidth;
    const rawInterval = bpPerPixel * targetPixelGap;

    // Round to a nice number
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    let interval: number;
    if (rawInterval / magnitude < 2) interval = magnitude;
    else if (rawInterval / magnitude < 5) interval = 2 * magnitude;
    else interval = 5 * magnitude;

    // Ensure interval is at least 1
    interval = Math.max(1, interval);

    // Draw background line
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(canvasWidth, height - 1);
    ctx.stroke();

    // Draw ticks
    const firstTick = Math.ceil(viewStart / interval) * interval;
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px ui-monospace, monospace';
    ctx.textAlign = 'center';

    for (let pos = firstTick; pos <= viewEnd; pos += interval) {
      const x = ((pos - viewStart) / viewWidth) * canvasWidth;

      // Major tick
      ctx.strokeStyle = '#4b5563';
      ctx.beginPath();
      ctx.moveTo(x, height - 1);
      ctx.lineTo(x, height - 8);
      ctx.stroke();

      // Label
      ctx.fillText(formatPosition(pos), x, height - 10);

      // Minor ticks (5 subdivisions)
      const minorInterval = interval / 5;
      for (let j = 1; j < 5; j++) {
        const minorPos = pos + j * minorInterval;
        if (minorPos > viewEnd) break;
        const mx = ((minorPos - viewStart) / viewWidth) * canvasWidth;
        ctx.strokeStyle = '#374151';
        ctx.beginPath();
        ctx.moveTo(mx, height - 1);
        ctx.lineTo(mx, height - 4);
        ctx.stroke();
      }
    }
  }, [viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} />;
}
