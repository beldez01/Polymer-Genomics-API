'use client';

import { useState, useMemo } from 'react';
import { BrandBar } from '@/components/BrandBar';
import { Footer } from '@/components/Footer';
import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { LAYERS, LAYER_GROUPS, EVIDENCE_LABELS, type LayerGroup, type EvidenceClass } from '@/config/dataSourcesData';

const subtitle = (
  <span style={{
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: 12,
    fontFamily: FONT_FAMILY_MONO,
    fontSize: TYPE.sm.fontSize,
    letterSpacing: '0.04em',
  }}>
    <span style={{ color: COLOR.text.tertiary }}>Data sources</span>
    <span style={{ color: COLOR.border.strong }}>·</span>
    <span style={{ color: COLOR.text.tertiary }}>50 layers · versions · provenance</span>
  </span>
);

const EVIDENCE_COLOR: Record<EvidenceClass, string> = {
  M: COLOR.primary.base,
  K: COLOR.accent.teal,
  D: COLOR.accent.violet,
  S: COLOR.accent.amber,
  H: COLOR.text.muted,
};

export default function DataSourcesPage() {
  const [query, setQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState<LayerGroup | 'all'>('all');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return LAYERS.filter((l) => {
      if (groupFilter !== 'all' && l.group !== groupFilter) return false;
      if (q.length >= 2) {
        const hay = `${l.id} ${l.name} ${l.description} ${l.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [query, groupFilter]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { all: LAYERS.length };
    for (const g of LAYER_GROUPS) {
      counts[g] = LAYERS.filter((l) => l.group === g).length;
    }
    return counts;
  }, []);

  return (
    <main style={{
      backgroundColor: COLOR.bg.primary,
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <BrandBar sticky subtitle={subtitle} />

      <section style={{
        maxWidth: 1280,
        width: '100%',
        margin: '0 auto',
        padding: `${SPACE[12]}px ${SPACE[6]}px ${SPACE[16]}px`,
        flex: 1,
      }}>
        {/* Header */}
        <div style={{ marginBottom: SPACE[8] }}>
          <div style={{
            color: COLOR.text.faint,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: SPACE[3],
          }}>
            § DATA SOURCES · {LAYERS.length} layers · versions · licenses · evidence classes
          </div>
          <h1 style={{
            margin: 0,
            color: COLOR.primary.base,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.xl.fontSize,
            lineHeight: TYPE.xl.lineHeight,
            letterSpacing: TYPE.xl.letterSpacing,
            fontWeight: WEIGHT.bold,
            marginBottom: SPACE[3],
          }}>
            Data sources
          </h1>
          <p style={{
            margin: 0,
            maxWidth: 720,
            color: COLOR.text.secondary,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            lineHeight: 1.55,
          }}>
            Every layer the Polymer API serves, with its origin, version, license, and evidence class.
            Each response from the API carries a content hash and the same evidence-class
            tags — so downstream pipelines can audit, cache, and cite.
          </p>
        </div>

        {/* Evidence-class legend */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[5],
          padding: SPACE[4],
          backgroundColor: COLOR.bg.elevated,
          border: `1px solid ${COLOR.border.subtle}`,
          borderRadius: 2,
          marginBottom: SPACE[6],
          flexWrap: 'wrap',
        }}>
          <span style={{
            color: COLOR.text.tertiary,
            fontFamily: FONT_FAMILY_MONO,
            fontSize: TYPE.xs.fontSize,
            fontWeight: WEIGHT.medium,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}>
            Evidence classes
          </span>
          {(Object.keys(EVIDENCE_LABELS) as EvidenceClass[]).map((e) => (
            <span key={e} style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: SPACE[2],
            }}>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                backgroundColor: EVIDENCE_COLOR[e],
                color: COLOR.bg.white,
                fontFamily: FONT_FAMILY_MONO,
                fontSize: 11,
                fontWeight: WEIGHT.bold,
                borderRadius: 2,
              }}>
                {e}
              </span>
              <span style={{
                color: COLOR.text.secondary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                fontWeight: WEIGHT.medium,
              }}>
                {EVIDENCE_LABELS[e].label}
              </span>
            </span>
          ))}
        </div>

        {/* Filter strip */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE[3],
          marginBottom: SPACE[5],
          flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: COLOR.bg.white,
            border: `1px solid ${COLOR.border.strong}`,
            borderRadius: 2,
            paddingLeft: SPACE[3],
            paddingRight: SPACE[2],
            height: 32,
            minWidth: 280,
          }}>
            <span style={{
              color: COLOR.text.faint,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginRight: SPACE[2],
            }}>
              Filter
            </span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="GENCODE, CpG, TP53, EPIC v2…"
              style={{
                flex: 1,
                backgroundColor: 'transparent',
                color: COLOR.text.primary,
                border: 'none',
                outline: 'none',
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                letterSpacing: '0.01em',
                padding: 0,
              }}
            />
          </div>

          {/* Group pills */}
          <button
            type="button"
            onClick={() => setGroupFilter('all')}
            style={pillStyle(groupFilter === 'all')}
          >
            All <span style={{ color: COLOR.text.faint, marginLeft: 4, fontFamily: FONT_FAMILY_MONO, fontSize: 10 }}>{groupCounts.all}</span>
          </button>
          {LAYER_GROUPS.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroupFilter(g)}
              style={pillStyle(groupFilter === g)}
            >
              {g} <span style={{ color: groupFilter === g ? `${COLOR.bg.white}99` : COLOR.text.faint, marginLeft: 4, fontFamily: FONT_FAMILY_MONO, fontSize: 10 }}>{groupCounts[g]}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div style={{
          border: `1px solid ${COLOR.border.default}`,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize }}>
            <thead>
              <tr style={{ backgroundColor: COLOR.bg.elevated }}>
                {['Layer', 'Description', 'Version', 'Source', 'License', 'Count', 'Build', 'EV'].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left',
                    padding: `${SPACE[2] + 2}px ${SPACE[3]}px`,
                    color: COLOR.text.tertiary,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: 10,
                    fontWeight: WEIGHT.medium,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    borderBottom: `1px solid ${COLOR.border.subtle}`,
                    whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((l, i) => (
                <tr key={l.id} style={{
                  borderBottom: i === visible.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
                }}>
                  <td style={td('left')}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: COLOR.text.primary, fontFamily: FONT_FAMILY, fontSize: TYPE.sm.fontSize, fontWeight: WEIGHT.semibold }}>
                        {l.name}
                      </span>
                      <span style={{ color: COLOR.text.faint, fontFamily: FONT_FAMILY_MONO, fontSize: 10, letterSpacing: '0.04em' }}>
                        {l.id} · {l.group}
                      </span>
                    </div>
                  </td>
                  <td style={td('left')}>
                    <span style={{ color: COLOR.text.secondary, lineHeight: 1.4 }}>{l.description}</span>
                  </td>
                  <td style={tdMono('left')}>{l.version}</td>
                  <td style={tdMono('left')}>{l.source}</td>
                  <td style={tdMono('left')}>{l.license}</td>
                  <td className="tabular" style={tdMono('left')}>{l.count}</td>
                  <td style={tdMono('left')}>
                    <span style={{
                      color: l.build === 'hg38+hg37' ? COLOR.primary.base : COLOR.text.tertiary,
                      fontWeight: WEIGHT.medium,
                    }}>{l.build}</span>
                  </td>
                  <td style={{ padding: `${SPACE[2] + 2}px ${SPACE[3]}px`, whiteSpace: 'nowrap' }}>
                    <span title={`${EVIDENCE_LABELS[l.evidence].label} — ${EVIDENCE_LABELS[l.evidence].description}`} style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 22,
                      height: 22,
                      backgroundColor: EVIDENCE_COLOR[l.evidence],
                      color: COLOR.bg.white,
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: 11,
                      fontWeight: WEIGHT.bold,
                      borderRadius: 2,
                      cursor: 'help',
                    }}>
                      {l.evidence}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <div style={{
            padding: SPACE[8],
            textAlign: 'center',
            color: COLOR.text.muted,
            fontFamily: FONT_FAMILY,
            fontSize: TYPE.base.fontSize,
            backgroundColor: COLOR.bg.elevated,
            border: `1px solid ${COLOR.border.subtle}`,
            borderRadius: 2,
            marginTop: SPACE[3],
          }}>
            No layers match this filter.
          </div>
        )}

        {/* Footer note */}
        <div style={{
          color: COLOR.text.faint,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.xs.fontSize,
          letterSpacing: '0.04em',
          marginTop: SPACE[4],
          textAlign: 'right',
        }}>
          Showing {visible.length} of {LAYERS.length} layers · every layer is queryable through{' '}
          <span style={{ color: COLOR.primary.base }}>/v1/layers</span>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${SPACE[1] + 2}px ${SPACE[3]}px`,
    backgroundColor: active ? COLOR.primary.base : 'transparent',
    color: active ? COLOR.bg.white : COLOR.text.secondary,
    border: `1px solid ${active ? COLOR.primary.base : COLOR.border.strong}`,
    borderRadius: 2,
    fontFamily: FONT_FAMILY,
    fontSize: TYPE.xs.fontSize,
    fontWeight: WEIGHT.medium,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'background-color 0.12s, color 0.12s, border-color 0.12s',
  };
}

function td(align: 'left' | 'right'): React.CSSProperties {
  return {
    textAlign: align,
    padding: `${SPACE[2] + 2}px ${SPACE[3]}px`,
    color: COLOR.text.primary,
    fontFamily: FONT_FAMILY,
    fontSize: TYPE.sm.fontSize,
    verticalAlign: 'top',
  };
}

function tdMono(align: 'left' | 'right'): React.CSSProperties {
  return { ...td(align), fontFamily: FONT_FAMILY_MONO, fontSize: TYPE.xs.fontSize, color: COLOR.text.secondary, letterSpacing: '0.02em' };
}
