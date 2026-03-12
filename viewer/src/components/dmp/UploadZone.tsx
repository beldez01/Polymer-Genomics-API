'use client';

import { useState, useCallback, useRef } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { parseCSV } from '@/lib/dmp/parse-csv';
import type { DMPDataset } from '@/lib/dmp/types';

interface UploadZoneProps {
  onDataLoaded: (dataset: DMPDataset) => void;
}

export function UploadZone({ onDataLoaded }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    setParsing(true);
    try {
      const text = await file.text();
      const dataset = parseCSV(text, file.name);
      onDataLoaded(dataset);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
    } finally {
      setParsing(false);
    }
  }, [onDataLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      style={{
        border: `2px dashed ${dragOver ? COLOR.accent.teal : COLOR.border.strong}`,
        backgroundColor: dragOver ? 'rgba(78, 205, 196, 0.04)' : COLOR.bg.elevated,
        padding: SPACE[12],
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACE[3],
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        minHeight: 200,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.tsv,.txt"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />

      {/* Upload icon */}
      <svg
        width="32"
        height="32"
        viewBox="0 0 24 24"
        fill="none"
        stroke={dragOver ? COLOR.accent.teal : COLOR.text.muted}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>

      <div style={{
        color: dragOver ? COLOR.accent.teal : COLOR.text.secondary,
        fontSize: TYPE.md.fontSize,
        fontFamily: FONT_FAMILY,
        fontWeight: WEIGHT.medium,
      }}>
        {parsing ? 'Parsing...' : 'Drop DMP results CSV here'}
      </div>

      <div style={{
        color: COLOR.text.muted,
        fontSize: TYPE.sm.fontSize,
        fontFamily: FONT_FAMILY,
      }}>
        CSV or TSV with probe_id, delta_beta, p_value columns
      </div>

      {error && (
        <div style={{
          color: COLOR.accent.rose,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          marginTop: SPACE[2],
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          border: `1px solid ${COLOR.accent.rose}40`,
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
