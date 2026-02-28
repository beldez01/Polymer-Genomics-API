/**
 * Draws subtle vertical gridlines at major tick positions.
 * Uses the same tick-interval algorithm as CoordinateRuler for perfect alignment.
 */
export function drawGridlines(
  ctx: CanvasRenderingContext2D,
  viewStart: number,
  viewEnd: number,
  canvasWidth: number,
  height: number,
) {
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

  const firstTick = Math.ceil(viewStart / interval) * interval;

  ctx.save();
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;

  for (let pos = firstTick; pos <= viewEnd; pos += interval) {
    const x = Math.round(((pos - viewStart) / viewWidth) * canvasWidth) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  ctx.restore();
}
