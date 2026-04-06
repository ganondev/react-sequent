/**
 * Internal error boundary for catching render errors within a flow.
 */
import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";

export interface ErrorStepContext {
  error: unknown;
  componentStack: string | null;
  failedStep: ComponentType;
}

interface FlowErrorBoundaryProps {
  children: ReactNode;
  failedStep: ComponentType;
  errorStep?: (context: ErrorStepContext) => ReactNode;
}

interface FlowErrorBoundaryState {
  hasError: boolean;
  error: unknown;
  componentStack: string | null;
}

class FlowErrorBoundary extends Component<FlowErrorBoundaryProps, FlowErrorBoundaryState> {
  constructor(props: FlowErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: unknown): FlowErrorBoundaryState {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(_error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      componentStack: errorInfo.componentStack ?? null,
    });
  }

  resetError(): void {
    this.setState({ hasError: false, error: null, componentStack: null });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.errorStep?.({
          error: this.state.error,
          componentStack: this.state.componentStack,
          failedStep: this.props.failedStep,
        }) ?? null
      );
    }
    return this.props.children;
  }
}

export { FlowErrorBoundary };
