'use client';

import React from 'react';
import { COLOR, FONT_FAMILY, SPACE, TYPE, WEIGHT } from '@/config/theme';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(
      `[ErrorBoundary${this.props.fallbackLabel ? ` :: ${this.props.fallbackLabel}` : ''}]`,
      error,
      errorInfo,
    );
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const label = this.props.fallbackLabel ?? 'Component';
      return (
        <div
          style={{
            backgroundColor: `${COLOR.accent.rose}10`,
            border: `1px solid ${COLOR.accent.rose}`,
            padding: `${SPACE[4]}px ${SPACE[5]}px`,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE[3],
          }}
        >
          <span
            style={{
              color: COLOR.accent.rose,
              fontSize: TYPE.sm.fontSize,
              fontFamily: FONT_FAMILY,
              fontWeight: WEIGHT.medium,
              letterSpacing: '0.06em',
            }}
          >
            {label.toUpperCase()} — RENDER ERROR
          </span>
          <pre
            style={{
              color: COLOR.text.secondary,
              fontSize: TYPE.xs.fontSize,
              fontFamily: FONT_FAMILY,
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              lineHeight: 1.5,
            }}
          >
            {this.state.error?.message ?? 'Unknown error'}
          </pre>
          <div>
            <button
              onClick={this.handleRetry}
              style={{
                backgroundColor: 'transparent',
                color: COLOR.text.secondary,
                border: `1px solid ${COLOR.border.strong}`,
                padding: `${SPACE[1]}px ${SPACE[3]}px`,
                fontSize: TYPE.xs.fontSize,
                fontFamily: FONT_FAMILY,
                fontWeight: WEIGHT.medium,
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
