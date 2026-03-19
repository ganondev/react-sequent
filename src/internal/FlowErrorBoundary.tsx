/**
 * Internal error boundary for catching render errors within a flow.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface FlowErrorBoundaryProps {
  children: ReactNode;
  errorFallback?: ReactNode;
}

interface FlowErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

class FlowErrorBoundary extends Component<FlowErrorBoundaryProps, FlowErrorBoundaryState> {
  constructor(props: FlowErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): FlowErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo): void {
    // No-op for now; consumers can extend later.
  }

  resetError(): void {
    this.setState({ hasError: false, error: null });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.errorFallback ?? null;
    }
    return this.props.children;
  }
}

export { FlowErrorBoundary };
