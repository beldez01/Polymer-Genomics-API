'use client';

import { CHROMOSOMES, GENOME_LENGTH } from '@/config/chromosomes';

interface IdeogramBarProps {
  currentChromosome: string;
  onSelectChromosome: (chr: string) => void;
}

export function IdeogramBar({ currentChromosome, onSelectChromosome }: IdeogramBarProps) {
  return (
    <div className="w-full flex items-stretch flex-shrink-0"
         style={{ height: 56, backgroundColor: '#0D0D0D', borderBottom: '1px solid #222', padding: '6px 4px', gap: 2 }}>
      {CHROMOSOMES.map(chr => {
        const pct = (chr.length / GENOME_LENGTH) * 100;
        const isActive = currentChromosome === chr.name;
        const isMito = chr.name === 'chrM';
        const label = chr.name.replace('chr', '');

        return (
          <button key={chr.name} onClick={() => onSelectChromosome(chr.name)}
                  title={`${chr.name} (${(chr.length / 1e6).toFixed(1)} Mb)`}
                  style={{
                    flex: isMito ? '0 0 20px' : `${pct} 0 0`,
                    minWidth: isMito ? 20 : 12,
                    backgroundColor: isActive ? '#1a2a28' : '#181818',
                    border: isActive ? '1px solid #4ECDC4' : '1px solid #2a2a2a',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                    transition: 'background-color 0.15s',
                  }}>
            {chr.centromereStart > 0 && (
              <div style={{
                position: 'absolute',
                left: `${(chr.centromereStart / chr.length) * 100}%`,
                width: `${Math.max(((chr.centromereEnd - chr.centromereStart) / chr.length) * 100, 4)}%`,
                height: '100%',
                backgroundColor: '#0A0A0A',
                opacity: 0.7,
                borderLeft: '1px solid #333',
                borderRight: '1px solid #333',
              }} />
            )}
            <span style={{
              color: isActive ? '#4ECDC4' : '#888',
              fontSize: 10,
              fontFamily: "'JetBrains Mono', monospace",
              fontWeight: isActive ? 700 : 500,
              position: 'relative', zIndex: 1, pointerEvents: 'none',
              letterSpacing: '-0.02em',
            }}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
