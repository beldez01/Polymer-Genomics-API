'use client';

import type { FormalClaim } from '@/config/formal_claims';
import { COLOR } from '@/config/theme';
import { useState } from 'react';
import { DagNodeSheet } from './DagNodeSheet';
import { OperationDag, type DagSelection } from './OperationDag';
import { Panel } from './Panel';

interface OperationsPanelProps {
  claim: FormalClaim;
}

export function OperationsPanel({ claim }: OperationsPanelProps) {
  const [selection, setSelection] = useState<DagSelection>(null);

  const nodeCount =
    claim.premises.length + claim.operations.length + claim.statistics.length;

  return (
    <Panel
      index={2}
      label="OPERATIONS (O)"
      accent={COLOR.accent.violet}
      trailing={
        <span>
          {claim.operations.length} op{claim.operations.length === 1 ? '' : 's'} · {nodeCount} nodes · click for detail
        </span>
      }
    >
      <OperationDag claim={claim} selection={selection} onSelect={setSelection} />
      <DagNodeSheet
        claim={claim}
        selection={selection}
        onClose={() => setSelection(null)}
      />
    </Panel>
  );
}
