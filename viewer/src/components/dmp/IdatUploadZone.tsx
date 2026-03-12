'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE, COMPONENT } from '@/config/theme';
import { uploadIdats, pollSessionStatus, fetchSessionResults, type SessionStatus } from '@/lib/dmp/idat-client';
import { PipelineProgress } from './PipelineProgress';
import { parseCSV } from '@/lib/dmp/parse-csv';
import type { DMPDataset } from '@/lib/dmp/types';

interface IdatUploadZoneProps {
  onResultsReady: (dataset: DMPDataset) => void;
}

function classifyIdatFiles(files: File[]): { pairs: number; unpaired: string[] } {
  const grnFiles = new Set<string>();
  const redFiles = new Set<string>();
  for (const f of files) {
    const name = f.name;
    if (name.endsWith('_Grn.idat')) {
      grnFiles.add(name.replace(/_Grn\.idat$/, ''));
    } else if (name.endsWith('_Red.idat')) {
      redFiles.add(name.replace(/_Red\.idat$/, ''));
    }
  }
  let pairs = 0;
  const unpaired: string[] = [];
  const allPrefixes = new Set([...grnFiles, ...redFiles]);
  for (const prefix of allPrefixes) {
    if (grnFiles.has(prefix) && redFiles.has(prefix)) {
      pairs++;
    } else {
      unpaired.push(prefix);
    }
  }
  return { pairs, unpaired };
}

export function IdatUploadZone({ onResultsReady }: IdatUploadZoneProps) {
  const [idatFiles, setIdatFiles] = useState<File[]>([]);
  const [sampleSheet, setSampleSheet] = useState<File | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'upload' | 'processing' | 'complete'>('upload');
  const [idatDragOver, setIdatDragOver] = useState(false);
  const [sheetDragOver, setSheetDragOver] = useState(false);

  const idatInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { pairs, unpaired } = classifyIdatFiles(idatFiles);
  const isValid = idatFiles.length > 0 && idatFiles.length % 2 === 0 && unpaired.length === 0;

  // -- IDAT drop/select handlers --

  const addIdatFiles = useCallback((incoming: FileList | File[]) => {
    const arr = Array.from(incoming).filter(f => f.name.endsWith('.idat'));
    if (arr.length === 0) {
      setError('Only .idat files are accepted');
      return;
    }
    setError(null);
    setIdatFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      const deduped = arr.filter(f => !existing.has(f.name));
      return [...prev, ...deduped];
    });
  }, []);

  const removeIdatFile = useCallback((name: string) => {
    setIdatFiles(prev => prev.filter(f => f.name !== name));
  }, []);

  const handleIdatDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIdatDragOver(false);
    addIdatFiles(e.dataTransfer.files);
  }, [addIdatFiles]);

  const handleIdatDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIdatDragOver(true);
  }, []);

  const handleIdatDragLeave = useCallback(() => setIdatDragOver(false), []);

  const handleIdatInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addIdatFiles(e.target.files);
    e.target.value = '';
  }, [addIdatFiles]);

  // -- Sample sheet handlers --

  const handleSheetDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSheetDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv') || file.name.endsWith('.txt'))) {
      setSampleSheet(file);
      setError(null);
    } else {
      setError('Sample sheet must be a CSV/TSV file');
    }
  }, []);

  const handleSheetDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setSheetDragOver(true);
  }, []);

  const handleSheetDragLeave = useCallback(() => setSheetDragOver(false), []);

  const handleSheetInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSampleSheet(file);
    e.target.value = '';
  }, []);

  // -- Pipeline --

  const startPipeline = useCallback(async () => {
    setError(null);
    setUploading(true);
    try {
      const { sessionId } = await uploadIdats(idatFiles, sampleSheet);
      setPhase('processing');
      setSessionStatus({
        sessionId,
        steps: [{ name: 'Load IDATs', status: 'running' }],
        currentStep: 'Load IDATs',
        complete: false,
      });

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const status = await pollSessionStatus(sessionId);
          setSessionStatus(status);
          if (status.complete) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            // Fetch results
            const csv = await fetchSessionResults(sessionId);
            const dataset = parseCSV(csv, `idat_results_${sessionId}.csv`);
            setPhase('complete');
            onResultsReady(dataset);
          }
          if (status.error) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setError(status.error);
          }
        } catch (err) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setError(err instanceof Error ? err.message : 'Pipeline status check failed');
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setPhase('upload');
    } finally {
      setUploading(false);
    }
  }, [idatFiles, sampleSheet, onResultsReady]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // -- Processing phase --

  if (phase === 'processing' || phase === 'complete') {
    return (
      <div style={{
        border: `1px solid ${COLOR.border.default}`,
        backgroundColor: COLOR.bg.elevated,
        padding: SPACE[6],
      }}>
        <div style={{
          ...COMPONENT.sectionHeader,
          marginBottom: SPACE[4],
        }}>
          IDAT PIPELINE
        </div>

        {sessionStatus && (
          <PipelineProgress
            steps={sessionStatus.steps}
            currentStep={sessionStatus.currentStep}
          />
        )}

        {error && (
          <div style={{
            color: COLOR.accent.rose,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            marginTop: SPACE[3],
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

  // -- Upload phase --

  return (
    <div style={{
      border: `1px solid ${COLOR.border.default}`,
      backgroundColor: COLOR.bg.elevated,
      padding: SPACE[6],
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE[4],
    }}>
      <div style={{ ...COMPONENT.sectionHeader }}>
        UPLOAD IDAT FILES
      </div>

      {/* IDAT drop zone */}
      <div
        onDrop={handleIdatDrop}
        onDragOver={handleIdatDragOver}
        onDragLeave={handleIdatDragLeave}
        onClick={() => idatInputRef.current?.click()}
        style={{
          border: `2px dashed ${idatDragOver ? COLOR.accent.teal : COLOR.border.strong}`,
          backgroundColor: idatDragOver ? 'rgba(78, 205, 196, 0.04)' : COLOR.bg.track,
          padding: SPACE[8],
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACE[2],
          cursor: 'pointer',
          transition: 'border-color 0.15s, background-color 0.15s',
          minHeight: 140,
        }}
      >
        <input
          ref={idatInputRef}
          type="file"
          accept=".idat"
          multiple
          onChange={handleIdatInputChange}
          style={{ display: 'none' }}
        />

        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke={idatDragOver ? COLOR.accent.teal : COLOR.text.muted}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>

        <div style={{
          color: idatDragOver ? COLOR.accent.teal : COLOR.text.secondary,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          fontWeight: WEIGHT.medium,
        }}>
          Drop IDAT files here or click to browse
        </div>

        <div style={{
          color: COLOR.text.faint,
          fontSize: TYPE.xs.fontSize,
          fontFamily: FONT_FAMILY,
        }}>
          Paired *_Grn.idat and *_Red.idat files
        </div>
      </div>

      {/* File count summary */}
      {idatFiles.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.sm.fontSize,
            color: isValid ? COLOR.accent.teal : COLOR.accent.amber,
            fontWeight: WEIGHT.medium,
          }}>
            {idatFiles.length} IDAT file{idatFiles.length !== 1 ? 's' : ''} ({pairs} pair{pairs !== 1 ? 's' : ''})
            {unpaired.length > 0 && ` — ${unpaired.length} unpaired`}
          </span>

          <button
            onClick={(e) => { e.stopPropagation(); setIdatFiles([]); }}
            style={{
              ...COMPONENT.button.small,
              fontSize: TYPE.xs.fontSize,
              padding: '3px 8px',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.borderColor = COLOR.accent.rose;
              (e.target as HTMLElement).style.color = COLOR.accent.rose;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.borderColor = COLOR.border.strong;
              (e.target as HTMLElement).style.color = COLOR.text.secondary;
            }}
          >
            Clear all
          </button>
        </div>
      )}

      {/* File list */}
      {idatFiles.length > 0 && (
        <div style={{
          maxHeight: 160,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}>
          {idatFiles.map(f => (
            <div
              key={f.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACE[1]}px ${SPACE[2]}px`,
                backgroundColor: COLOR.bg.surface,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
              }}
            >
              <span style={{
                color: COLOR.text.tertiary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                flex: 1,
                marginRight: SPACE[2],
              }}>
                {f.name}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); removeIdatFile(f.name); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: COLOR.text.faint,
                  cursor: 'pointer',
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.xs.fontSize,
                  padding: '0 4px',
                  lineHeight: 1,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.target as HTMLElement).style.color = COLOR.accent.rose; }}
                onMouseLeave={(e) => { (e.target as HTMLElement).style.color = COLOR.text.faint; }}
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Sample sheet drop zone */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE[1] }}>
        <span style={{
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.xs.fontSize,
          color: COLOR.text.muted,
          letterSpacing: '0.06em',
        }}>
          SAMPLE SHEET (optional)
        </span>
        <div
          onDrop={handleSheetDrop}
          onDragOver={handleSheetDragOver}
          onDragLeave={handleSheetDragLeave}
          onClick={() => sheetInputRef.current?.click()}
          style={{
            border: `1px dashed ${sheetDragOver ? COLOR.accent.teal : COLOR.border.strong}`,
            backgroundColor: sheetDragOver ? 'rgba(78, 205, 196, 0.04)' : COLOR.bg.track,
            padding: `${SPACE[2]}px ${SPACE[3]}px`,
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[2],
            cursor: 'pointer',
            transition: 'border-color 0.15s, background-color 0.15s',
            minHeight: 36,
          }}
        >
          <input
            ref={sheetInputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            onChange={handleSheetInputChange}
            style={{ display: 'none' }}
          />
          <span style={{
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xs.fontSize,
            color: sampleSheet ? COLOR.text.secondary : COLOR.text.faint,
          }}>
            {sampleSheet ? sampleSheet.name : 'Drop sample sheet CSV here'}
          </span>
          {sampleSheet && (
            <button
              onClick={(e) => { e.stopPropagation(); setSampleSheet(null); }}
              style={{
                background: 'none',
                border: 'none',
                color: COLOR.text.faint,
                cursor: 'pointer',
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                padding: '0 4px',
                marginLeft: 'auto',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.color = COLOR.accent.rose; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.color = COLOR.text.faint; }}
            >
              x
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div style={{
          color: COLOR.accent.rose,
          fontSize: TYPE.sm.fontSize,
          fontFamily: FONT_FAMILY,
          padding: `${SPACE[2]}px ${SPACE[4]}px`,
          backgroundColor: 'rgba(244, 63, 94, 0.08)',
          border: `1px solid ${COLOR.accent.rose}40`,
        }}>
          {error}
        </div>
      )}

      {/* Start button */}
      <button
        onClick={startPipeline}
        disabled={!isValid || uploading}
        style={{
          ...COMPONENT.button.small,
          alignSelf: 'flex-start',
          padding: '7px 16px',
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
          backgroundColor: isValid && !uploading ? COLOR.accent.teal : COLOR.bg.track,
          color: isValid && !uploading ? COLOR.bg.primary : COLOR.text.faint,
          borderColor: isValid && !uploading ? COLOR.accent.teal : COLOR.border.strong,
          cursor: isValid && !uploading ? 'pointer' : 'not-allowed',
          opacity: uploading ? 0.6 : 1,
          transition: 'background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s',
        }}
      >
        {uploading ? 'Uploading...' : 'Start Pipeline'}
      </button>
    </div>
  );
}
