'use client';

import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

interface ModeTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'landscape', label: 'Landscape', enabled: true },
  { id: 'reactivation', label: 'Clinical Reactivation', enabled: false },
  { id: 'probes', label: 'Probe Coverage', enabled: false },
  { id: 'region', label: 'Region Tools', enabled: false },
  { id: 'directory', label: 'Family Directory', enabled: false },
];

export function ModeTabs({ activeTab, onTabChange }: ModeTabsProps) {
  return (
    <div style={{
      display: 'flex',
      gap: SPACE[1],
      borderBottom: `1px solid ${COLOR.border.subtle}`,
    }}>
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => tab.enabled && onTabChange(tab.id)}
          disabled={!tab.enabled}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: `2px solid ${activeTab === tab.id ? COLOR.accent.teal : 'transparent'}`,
            color: !tab.enabled
              ? COLOR.text.faint
              : activeTab === tab.id
                ? COLOR.accent.teal
                : COLOR.text.muted,
            fontSize: TYPE.sm.fontSize,
            fontFamily: FONT_FAMILY,
            fontWeight: activeTab === tab.id ? WEIGHT.medium : WEIGHT.normal,
            letterSpacing: '0.04em',
            padding: `${SPACE[2]}px ${SPACE[4]}px`,
            cursor: !tab.enabled ? 'default' : 'pointer',
            opacity: !tab.enabled ? 0.4 : 1,
            transition: 'color 0.15s, border-color 0.15s',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
