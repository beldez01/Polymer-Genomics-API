'use client';

import type { Statistic } from '@/config/formal_claims';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { EVIDENCE_LABELS, renderStatValue } from '@/lib/formalClaimsHelpers';
import { Chip, Panel } from './Panel';

interface StatisticsPanelProps {
  statistics: Statistic[];
}

export function StatisticsPanel({ statistics }: StatisticsPanelProps) {
  return (
    <Panel
      index={3}
      label="STATISTICS (S)"
      accent={COLOR.accent.amber}
      trailing={<span>{statistics.length} measurement{statistics.length === 1 ? '' : 's'}</span>}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${COLOR.border.default}` }}>
            <Th>ID</Th>
            <Th>Name</Th>
            <Th align="right">Value</Th>
            <Th align="right">CI</Th>
            <Th align="right">n</Th>
            <Th align="center">Class</Th>
            <Th align="center">Status</Th>
          </tr>
        </thead>
        <tbody>
          {statistics.map((s) => (
            <StatRow key={s.id} stat={s} />
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function StatRow({ stat }: { stat: Statistic }) {
  return (
    <>
      <tr style={{ borderBottom: `1px solid ${COLOR.border.subtle}` }}>
        <Td mono>{stat.id}</Td>
        <Td>{stat.name}</Td>
        <Td align="right" emphasize>
          {renderStatValue(stat.value)}
        </Td>
        <Td align="right">
          {stat.ci ? `[${stat.ci[0].toFixed(3)}, ${stat.ci[1].toFixed(3)}]` : '—'}
        </Td>
        <Td align="right">
          {stat.n !== null && stat.n !== undefined ? stat.n.toLocaleString() : '—'}
        </Td>
        <Td align="center">
          <Chip title={EVIDENCE_LABELS[stat.evidence_class]}>{stat.evidence_class}</Chip>
        </Td>
        <Td align="center">
          <Chip color={COLOR.text.muted} title="Status badge populates in M2 once evaluate.py re-runs the operation DAG">
            pending
          </Chip>
        </Td>
      </tr>
      {stat.note ? (
        <tr>
          <td colSpan={7} style={{ padding: `0 ${SPACE[3]}px ${SPACE[3]}px` }}>
            <p
              style={{
                margin: 0,
                color: COLOR.text.tertiary,
                fontSize: TYPE.sm.fontSize,
                lineHeight: 1.6,
              }}
            >
              {stat.note}
            </p>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function Th({ children, align = 'left' }: { children: React.ReactNode; align?: 'left' | 'right' | 'center' }) {
  return (
    <th
      style={{
        textAlign: align,
        color: COLOR.text.muted,
        fontSize: TYPE.sm.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'left',
  mono = false,
  emphasize = false,
}: {
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  mono?: boolean;
  emphasize?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: `${SPACE[2]}px ${SPACE[3]}px`,
        color: emphasize ? COLOR.text.primary : COLOR.text.secondary,
        fontFamily: mono ? FONT_FAMILY : FONT_FAMILY,
        fontSize: TYPE.base.fontSize,
        fontWeight: emphasize ? WEIGHT.medium : WEIGHT.normal,
        verticalAlign: 'top',
      }}
    >
      {children}
    </td>
  );
}
