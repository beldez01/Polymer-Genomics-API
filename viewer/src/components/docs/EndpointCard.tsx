'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT } from '@/config/theme';
import { CodeBlock } from './CodeBlock';
import type { APIEndpoint } from '@/config/apiDocsData';

interface EndpointCardProps {
  endpoint: APIEndpoint;
}

export function EndpointCard({ endpoint }: EndpointCardProps) {
  const methodColor = endpoint.method === 'GET' ? COLOR.primary.base : COLOR.accent.violet;

  return (
    <div
      id={endpoint.id}
      style={{
        backgroundColor: COLOR.bg.elevated,
        border: `1px solid ${COLOR.border.default}`,
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      {/* Title row */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE[3],
        padding: `${SPACE[4]}px ${SPACE[5]}px`,
        borderBottom: `1px solid ${COLOR.border.subtle}`,
      }}>
        <span style={{
          padding: '3px 8px',
          backgroundColor: methodColor,
          color: COLOR.bg.white,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: 11,
          fontWeight: WEIGHT.bold,
          letterSpacing: '0.16em',
          borderRadius: 2,
        }}>
          {endpoint.method}
        </span>
        <span style={{
          color: COLOR.text.primary,
          fontFamily: FONT_FAMILY_MONO,
          fontSize: TYPE.base.fontSize,
          fontWeight: WEIGHT.semibold,
          letterSpacing: '0.01em',
        }}>
          {endpoint.path}
        </span>
        <span style={{ flex: 1 }} />
        <span style={{
          color: COLOR.text.tertiary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
          fontWeight: WEIGHT.medium,
        }}>
          {endpoint.title}
        </span>
      </div>

      {/* Description */}
      <div style={{ padding: `${SPACE[4]}px ${SPACE[5]}px` }}>
        <p style={{
          margin: 0,
          color: COLOR.text.secondary,
          fontFamily: FONT_FAMILY,
          fontSize: TYPE.sm.fontSize,
          lineHeight: 1.55,
          marginBottom: SPACE[4],
        }}>
          {endpoint.description}
        </p>

        {/* Parameters */}
        {endpoint.params.length > 0 && (
          <div style={{ marginBottom: SPACE[4] }}>
            <div style={{
              color: COLOR.text.tertiary,
              fontFamily: FONT_FAMILY_MONO,
              fontSize: TYPE.xs.fontSize,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              marginBottom: SPACE[2],
            }}>
              Parameters
            </div>
            <div style={{
              border: `1px solid ${COLOR.border.subtle}`,
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              {endpoint.params.map((p, i) => (
                <div key={p.name} style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 80px 1fr',
                  gap: SPACE[3],
                  padding: `${SPACE[2]}px ${SPACE[3]}px`,
                  borderBottom: i === endpoint.params.length - 1 ? 'none' : `1px solid ${COLOR.border.subtle}`,
                  backgroundColor: COLOR.bg.white,
                }}>
                  <span>
                    <span style={{
                      color: COLOR.text.primary,
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: TYPE.sm.fontSize,
                      fontWeight: WEIGHT.semibold,
                    }}>
                      {p.name}
                    </span>
                    {p.required && (
                      <span style={{
                        marginLeft: SPACE[1],
                        color: COLOR.accent.rose,
                        fontFamily: FONT_FAMILY_MONO,
                        fontSize: 10,
                        fontWeight: WEIGHT.bold,
                      }}>
                        *
                      </span>
                    )}
                    <span style={{
                      display: 'block',
                      color: COLOR.text.faint,
                      fontFamily: FONT_FAMILY_MONO,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      marginTop: 1,
                    }}>
                      {p.in} · {p.type}
                    </span>
                  </span>
                  <span style={{
                    color: p.default ? COLOR.text.tertiary : COLOR.text.faint,
                    fontFamily: FONT_FAMILY_MONO,
                    fontSize: TYPE.xs.fontSize,
                  }}>
                    {p.default ? `= ${p.default}` : '—'}
                  </span>
                  <span style={{
                    color: COLOR.text.secondary,
                    fontFamily: FONT_FAMILY,
                    fontSize: TYPE.sm.fontSize,
                    lineHeight: 1.4,
                  }}>
                    {p.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Example: curl */}
        <div style={{ marginBottom: SPACE[3] }}>
          <CodeBlock code={endpoint.exampleCurl} language="curl" />
        </div>

        {/* Example: Python */}
        <CodeBlock code={endpoint.examplePython} language="python" />
      </div>
    </div>
  );
}
