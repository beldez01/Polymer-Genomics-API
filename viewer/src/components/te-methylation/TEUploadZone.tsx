'use client';

import { useCallback, useState, useRef } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import { parseBetaFile, type Platform } from '@/lib/te-methylation/parse-betas';

interface Props {
  onDataLoaded: (betas: Map<string, number>, platform: Platform, filename: string) => void;
}

export function TEUploadZone({ onDataLoaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setParsing(true);
      try {
        const text = await file.text();
        const result = parseBetaFile(text);
        if (result.betas.size === 0) {
          setError('No valid probe beta values found. Expected CSV/TSV with probe_id and beta columns.');
          return;
        }
        if (result.errors.length > 0) {
          // Non-fatal warnings — proceed
        }
        onDataLoaded(result.betas, result.platform, file.name);
      } catch (e) {
        setError(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setParsing(false);
      }
    },
    [onDataLoaded],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleClick = useCallback(() => inputRef.current?.click(), []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
      style={{
        border: `2px dashed ${dragging ? COLOR.accent.teal : COLOR.border.subtle}`,
        borderRadius: 12,
        padding: SPACE[12],
        textAlign: 'center',
        cursor: 'pointer',
        background: dragging ? `${COLOR.accent.teal}08` : COLOR.bg.primary,
        transition: 'border-color 0.15s, background 0.15s',
        minHeight: 180,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE[3],
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        style={{ display: 'none' }}
        onChange={handleInputChange}
      />

      {parsing ? (
        <span style={{ fontFamily: FONT_FAMILY, fontSize: TYPE.base.fontSize, color: COLOR.text.secondary }}>
          Parsing beta values...
        </span>
      ) : (
        <>
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.lg.fontSize,
            fontWeight: WEIGHT.bold,
            color: COLOR.text.primary,
            letterSpacing: TYPE.lg.letterSpacing,
          }}>
            Drop beta values here
          </span>
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            color: COLOR.text.tertiary,
            maxWidth: 420,
            lineHeight: 1.5,
          }}>
            CSV or TSV with probe_id + beta columns. Auto-detects platform
            (27K / 450K / EPIC v1 / EPIC v2). Single sample or averaged betas.
          </span>
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xs.fontSize,
            color: COLOR.text.muted,
            marginTop: SPACE[2],
          }}>
            or click to browse
          </span>
        </>
      )}

      {error && (
        <span style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
          color: COLOR.accent.rose,
          marginTop: SPACE[2],
        }}>
          {error}
        </span>
      )}
    </div>
  );
}
