'use client';

import { useEffect, useId } from 'react';
import { COLOR, TYPE, WEIGHT, FONT_FAMILY, SPACE } from '@/config/theme';
import type { PipelineStep } from '@/lib/dmp/idat-client';

interface PipelineProgressProps {
  steps: PipelineStep[];
  currentStep: string;
}

const PIPELINE_STEPS = [
  'Load IDATs',
  'Normalize (openSesame)',
  'Filter Probes',
  'Run limma',
  'View Results',
];

const CIRCLE_SIZE = 14;
const LINE_HEIGHT_PX = 32;

function StatusIcon({ status }: { status: PipelineStep['status']; animId: string }) {
  if (status === 'complete') {
    return (
      <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" fill={COLOR.accent.teal} />
        <polyline
          points="4,7 6,9.5 10,4.5"
          fill="none"
          stroke={COLOR.bg.primary}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (status === 'running') {
    return (
      <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox="0 0 14 14">
        <circle
          cx="7" cy="7" r="6"
          fill={COLOR.accent.teal}
          style={{ animation: 'pipeline-pulse 1.4s ease-in-out infinite' }}
        />
      </svg>
    );
  }
  if (status === 'error') {
    return (
      <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="6" fill={COLOR.accent.rose} />
        <line x1="5" y1="5" x2="9" y2="9" stroke={COLOR.bg.primary} strokeWidth="1.5" strokeLinecap="round" />
        <line x1="9" y1="5" x2="5" y2="9" stroke={COLOR.bg.primary} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  // pending
  return (
    <svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="5.5" fill="none" stroke={COLOR.text.faint} strokeWidth="1" />
    </svg>
  );
}

function stepTextColor(status: PipelineStep['status']): string {
  switch (status) {
    case 'running':  return COLOR.accent.teal;
    case 'complete': return COLOR.text.secondary;
    case 'error':    return COLOR.accent.rose;
    default:         return COLOR.text.muted;
  }
}

function lineColor(currentStatus: PipelineStep['status']): string {
  return currentStatus === 'complete' ? COLOR.accent.teal : COLOR.border.strong;
}

export function PipelineProgress({ steps, currentStep }: PipelineProgressProps) {
  const id = useId();

  // Merge default step names with server-provided statuses
  const mergedSteps: PipelineStep[] = PIPELINE_STEPS.map(name => {
    const match = steps.find(s => s.name === name);
    return match || { name, status: 'pending' as const };
  });

  return (
    <div style={{ padding: SPACE[4] }}>
      <style>{`
        @keyframes pipeline-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {mergedSteps.map((step, i) => (
        <div key={step.name}>
          {/* Step row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE[3],
            height: LINE_HEIGHT_PX,
          }}>
            <div style={{
              width: CIRCLE_SIZE,
              height: CIRCLE_SIZE,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <StatusIcon status={step.status} animId={id} />
            </div>

            <span style={{
              fontFamily: FONT_FAMILY,
              fontSize: TYPE.sm.fontSize,
              fontWeight: step.status === 'running' ? WEIGHT.medium : WEIGHT.normal,
              color: stepTextColor(step.status),
              letterSpacing: TYPE.sm.letterSpacing,
            }}>
              {step.name}
            </span>

            {step.status === 'running' && (
              <span style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                color: COLOR.text.tertiary,
                marginLeft: 'auto',
              }}>
                {step.message || 'Processing...'}
              </span>
            )}

            {step.status === 'error' && step.message && (
              <span style={{
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.xs.fontSize,
                color: COLOR.accent.rose,
                marginLeft: 'auto',
                maxWidth: 300,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {step.message}
              </span>
            )}
          </div>

          {/* Connector line */}
          {i < mergedSteps.length - 1 && (
            <div style={{
              width: 1,
              height: SPACE[3],
              backgroundColor: lineColor(step.status),
              marginLeft: CIRCLE_SIZE / 2,
              transition: 'background-color 0.3s',
            }} />
          )}
        </div>
      ))}
    </div>
  );
}
