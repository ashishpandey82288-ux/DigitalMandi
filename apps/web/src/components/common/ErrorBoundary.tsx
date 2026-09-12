// ==============================================================================
// KisanFlow — Error Boundary Component
// ==============================================================================

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button.tsx';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('DigitalMandi UI Uncaught error:', error, errorInfo);
  }


  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-neutral-50">
          <div className="max-w-md w-full bg-white rounded-xl border border-neutral-200 p-6 shadow-sm text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-neutral-900 mb-2">Something went wrong</h2>
            <p className="text-xs text-neutral-600 mb-4">
              {this.state.error?.message || 'An unexpected rendering error occurred in the application view.'}
            </p>
            <Button onClick={this.handleReset} variant="outline" className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              <span>Reload Application</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
