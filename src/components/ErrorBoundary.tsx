import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ArrowLeft, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  onClose?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class SettingsErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[SettingsErrorBoundary caught error]:', error, errorInfo);
  }

  private handleBack = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onClose) {
      this.props.onClose();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="modal-overlay"
          onClick={this.handleBack}
          style={{
            zIndex: 9999,
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '480px',
              padding: '32px 24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
              backgroundColor: '#181818',
              borderRadius: '8px',
              border: '1px solid #333'
            }}
          >
            <AlertTriangle size={44} color="#e50914" />
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#fff' }}>
              Settings Encountered an Error
            </h2>
            <p style={{ fontSize: '13px', color: '#aaa', margin: 0 }}>
              {this.state.error?.message || 'Failed to display Settings. Your data is safe.'}
            </p>
            <button
              onClick={this.handleBack}
              style={{
                marginTop: '12px',
                background: '#e50914',
                color: '#fff',
                border: 'none',
                padding: '8px 22px',
                borderRadius: '4px',
                fontWeight: 600,
                fontSize: '14px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
