/**
 * Draws a faded track label at the top-left corner of a canvas track.
 * Call after all track content is drawn so it sits on top.
 */
export function drawTrackLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  canvasWidth: number,
) {
  if (canvasWidth < 120) return;

  ctx.save();
  ctx.fillStyle = 'rgba(10, 10, 10, 0.7)';
  const metrics = ctx.measureText(label);
  // Measure with the font we're about to use
  ctx.font = "10px 'JetBrains Mono', monospace";
  const textW = ctx.measureText(label).width;
  ctx.fillRect(4, 3, textW + 10, 15);

  ctx.fillStyle = '#555555';
  ctx.font = "10px 'JetBrains Mono', monospace";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(label, 9, 5);
  ctx.restore();
}
