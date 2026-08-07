import type { ReactNode } from 'react';

interface SocialCardProps {
  eyebrow: string;
  title: string;
  description: string;
  badges: string[];
  path?: string;
  titleSize?: number;
  children?: ReactNode;
}

export function SocialCard({
  eyebrow,
  title,
  description,
  badges,
  path = 'polymerbio.org',
  titleSize = 78,
  children,
}: SocialCardProps) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '64px 82px 58px',
      borderTop: '9px solid #0F62FE',
      backgroundColor: '#F4F4F5',
      color: '#18181B',
      fontFamily: 'Arial, Helvetica, sans-serif',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        color: '#52525B',
        fontFamily: 'Menlo, Monaco, monospace',
        fontSize: 20,
        fontWeight: 700,
        letterSpacing: '0.22em',
        textTransform: 'uppercase',
      }}>
        {eyebrow}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
      }}>
        <div style={{
          display: 'flex',
          maxWidth: 1040,
          color: '#0F62FE',
          fontSize: titleSize,
          lineHeight: 0.98,
          letterSpacing: '-0.045em',
          fontWeight: 700,
        }}>
          {title}
        </div>
        <div style={{
          display: 'flex',
          maxWidth: 1010,
          marginTop: 30,
          color: '#3F3F46',
          fontSize: 31,
          lineHeight: 1.28,
          letterSpacing: '-0.018em',
        }}>
          {description}
        </div>
        {children}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 24,
        borderTop: '1px solid #A1A1AA',
      }}>
        <div style={{ display: 'flex', gap: 12 }}>
          {badges.map((badge, index) => (
            <div key={badge} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px 7px',
              border: `1px solid ${index === 0 ? '#0F62FE' : '#71717A'}`,
              color: index === 0 ? '#0F62FE' : '#52525B',
              fontFamily: 'Menlo, Monaco, monospace',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              {badge}
            </div>
          ))}
        </div>
        <div style={{
          display: 'flex',
          color: '#52525B',
          fontFamily: 'Menlo, Monaco, monospace',
          fontSize: 18,
          letterSpacing: '0.1em',
        }}>
          {path}
        </div>
      </div>
    </div>
  );
}
