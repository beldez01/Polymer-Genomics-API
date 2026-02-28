'use client';
import { useRef, useEffect } from 'react';
import { COLORS } from '@/config/colors';

interface CoordinateRulerProps {
  viewStart: number;
  viewEnd: number;
  canvasWidth: number;
  height?: number;
}

function formatPosition(pos: number, interval: number): string {
  if (interval >= 1_000_000) {
    const decimals = interval >= 10_000_000 ? 0 : interval >= 1_000_000 ? 1 : 2;
    return `${(pos / 1_000_000).toFixed(decimals)} Mb`;
  }
  if (interval >= 1_000) {
    const decimals = interval >= 100_000 ? 0 : interval >= 10_000 ? 1 : 2;
    return `${(pos / 1_000).toFixed(decimals)} kb`;
  }
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
    const targetPixelGap = 100;
    const bpPerPixel = viewWidth / canvasWidth;
    const rawInterval = bpPerPixel * targetPixelGap;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawInterval)));
    let interval: number;
    if (rawInterval / magnitude < 2) interval = magnitude;
    else if (rawInterval / magnitude < 5) interval = 2 * magnitude;
    else interval = 5 * magnitude;
    interval = Math.max(1, interval);

    ctx.strokeStyle = COLORS.border.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, height - 1);
    ctx.lineTo(canvasWidth, height - 1);
    ctx.stroke();

    const firstTick = Math.ceil(viewStart / interval) * interval;
    ctx.fillStyle = COLORS.canvas.axisLabel;
    ctx.font = "10px 'JetBrains Mono', monospace";
    ctx.textAlign = 'center';

    for (let pos = firstTick; pos <= viewEnd; pos += interval) {
      const x = ((pos - viewStart) / viewWidth) * canvasWidth;

      ctx.strokeStyle = COLORS.canvas.tickMark;
      ctx.beginPath();
      ctx.moveTo(x, height - 1);
      ctx.lineTo(x, height - 8);
      ctx.stroke();

      ctx.fillText(formatPosition(pos, interval), x, height - 10);

      const minorInterval = interval / 5;
      for (let j = 1; j < 5; j++) {
        const minorPos = pos + j * minorInterval;
        if (minorPos > viewEnd) break;
        const mx = ((minorPos - viewStart) / viewWidth) * canvasWidth;
        ctx.strokeStyle = COLORS.border.axis;
        ctx.beginPath();
        ctx.moveTo(mx, height - 1);
        ctx.lineTo(mx, height - 4);
        ctx.stroke();
      }
    }
  }, [viewStart, viewEnd, canvasWidth, height]);

  return <canvas ref={canvasRef} />;
}
