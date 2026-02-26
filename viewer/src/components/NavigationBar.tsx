'use client';
import { useViewport } from '@/stores/viewport';

const ZOOM_PRESETS = [
  { label: '1 bp', width: 50 },
  { label: '1 kb', width: 1_000 },
  { label: '10 kb', width: 10_000 },
  { label: '100 kb', width: 100_000 },
  { label: '1 Mb', width: 1_000_000 },
  { label: '10 Mb', width: 10_000_000 },
];

export function NavigationBar() {
  const { chr, start, end, width, zoomIn, zoomOut, panLeft, panRight, setRegion } = useViewport();

  // Zoom slider: logarithmic scale mapping viewport width
  const minLog = Math.log10(10); // 10 bp minimum
  const maxLog = Math.log10(250_000_000); // ~chromosome length
  const currentLog = Math.log10(Math.max(10, width));

  function handleSlider(value: number) {
    const newWidth = Math.round(Math.pow(10, value));
    const center = (start + end) / 2;
    const halfWidth = newWidth / 2;
    setRegion(chr, Math.max(1, Math.round(center - halfWidth)), Math.round(center + halfWidth));
  }

  function handlePreset(targetWidth: number) {
    const center = (start + end) / 2;
    const halfWidth = targetWidth / 2;
    setRegion(chr, Math.max(1, Math.round(center - halfWidth)), Math.round(center + halfWidth));
  }

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 bg-gray-900/80 border-b border-gray-800">
      {/* Pan buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => panLeft()}
          className="px-2 py-0.5 text-sm bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
          title="Pan left 25%"
        >
          &larr;
        </button>
        <button
          onClick={() => panRight()}
          className="px-2 py-0.5 text-sm bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
          title="Pan right 25%"
        >
          &rarr;
        </button>
      </div>

      {/* Zoom buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => zoomIn()}
          className="px-2 py-0.5 text-sm bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
          title="Zoom in 2x"
        >
          +
        </button>
        <button
          onClick={() => zoomOut()}
          className="px-2 py-0.5 text-sm bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
          title="Zoom out 2x"
        >
          &minus;
        </button>
      </div>

      {/* Zoom slider (log scale) */}
      <input
        type="range"
        min={minLog}
        max={maxLog}
        step={0.01}
        value={currentLog}
        onChange={(e) => handleSlider(parseFloat(e.target.value))}
        className="w-48 accent-blue-500"
        title={`Viewport: ${width.toLocaleString()} bp`}
      />

      {/* Zoom presets */}
      <div className="flex gap-1">
        {ZOOM_PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.width)}
            className={`px-2 py-0.5 text-xs rounded transition-colors ${
              Math.abs(width - p.width) < p.width * 0.2
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Width display */}
      <span className="text-xs text-gray-500 ml-auto">{width.toLocaleString()} bp</span>
    </div>
  );
}
