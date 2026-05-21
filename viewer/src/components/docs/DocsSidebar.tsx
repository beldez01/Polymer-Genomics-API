'use client';

import { COLOR, FONT_FAMILY, FONT_FAMILY_MONO, SPACE, TYPE, WEIGHT, LAYOUT } from '@/config/theme';

export interface NavItem {
  id: string;
  label: string;
  children?: NavItem[];
}

interface DocsSidebarProps {
  items: NavItem[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function DocsSidebar({ items, activeId, onSelect }: DocsSidebarProps) {
  return (
    <aside style={{
      width: LAYOUT.docsSidebarWidth,
      flexShrink: 0,
      borderRight: `1px solid ${COLOR.border.subtle}`,
      paddingTop: SPACE[8],
      paddingRight: SPACE[5],
      position: 'sticky',
      top: LAYOUT.headerHeight,
      alignSelf: 'flex-start',
      maxHeight: `calc(100vh - ${LAYOUT.headerHeight}px)`,
      overflowY: 'auto',
    }}>
      <div style={{
        color: COLOR.text.faint,
        fontFamily: FONT_FAMILY_MONO,
        fontSize: TYPE.xs.fontSize,
        fontWeight: WEIGHT.medium,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        marginBottom: SPACE[3],
      }}>
        On this page
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((item) => (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => onSelect(item.id)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                borderLeft: `2px solid ${activeId === item.id ? COLOR.primary.base : 'transparent'}`,
                padding: `${SPACE[1] + 2}px 0 ${SPACE[1] + 2}px ${SPACE[3]}px`,
                color: activeId === item.id ? COLOR.primary.base : COLOR.text.secondary,
                fontFamily: FONT_FAMILY,
                fontSize: TYPE.sm.fontSize,
                fontWeight: activeId === item.id ? WEIGHT.semibold : WEIGHT.medium,
                letterSpacing: '0.01em',
                cursor: 'pointer',
                transition: 'color 0.12s, border-color 0.12s',
              }}
              onMouseEnter={(e) => {
                if (activeId !== item.id) {
                  (e.currentTarget as HTMLButtonElement).style.color = COLOR.text.primary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeId !== item.id) {
                  (e.currentTarget as HTMLButtonElement).style.color = COLOR.text.secondary;
                }
              }}
            >
              {item.label}
            </button>
            {item.children?.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelect(child.id)}
                style={{
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  background: 'transparent',
                  border: 'none',
                  padding: `${SPACE[1]}px 0 ${SPACE[1]}px ${SPACE[5] + 2}px`,
                  color: activeId === child.id ? COLOR.primary.base : COLOR.text.tertiary,
                  fontFamily: FONT_FAMILY,
                  fontSize: TYPE.xs.fontSize,
                  fontWeight: activeId === child.id ? WEIGHT.semibold : WEIGHT.normal,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  transition: 'color 0.12s',
                }}
              >
                {child.label}
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
