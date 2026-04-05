/**
 * Internal error boundary for catching render errors within a flow.
 */
import { Component, type ComponentType, type ErrorInfo, type ReactNode } from "react";

export type ErrorStepPhase = "render" | "transition";

export interface ErrorStepContext {
  error: unknown;
  componentStack: string | null;
  failedStep: ComponentType;
  phase: ErrorStepPhase;
}

interface FlowErrorBoundaryProps {
  children: ReactNode;
  failedStep: ComponentType;
  phase: ErrorStepPhase;
  errorStep?: (context: ErrorStepContext) => ReactNode;
}

interface FlowErrorBoundaryState {
  hasError: boolean;
  error: unknown;
  componentStack: string | null;
  phase: ErrorStepPhase;
}

class FlowErrorBoundary extends Component<FlowErrorBoundaryProps, FlowErrorBoundaryState> {
  constructor(props: FlowErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null, phase: "render" };
  }

  static getDerivedStateFromError(error: unknown): FlowErrorBoundaryState {
    return { hasError: true, error, componentStack: null, phase: "render" };
  }

  componentDidCatch(_error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      componentStack: errorInfo.componentStack ?? null,
      phase: this.props.phase,
    });
  }

  resetError(): void {
    this.setState({ hasError: false, error: null, componentStack: null, phase: "render" });
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        this.props.errorStep?.({
          error: this.state.error,
          componentStack: this.state.componentStack,
          failedStep: this.props.failedStep,
          phase: this.state.phase,
        }) ?? null
      );
    }
    return this.props.children;
  }
}

export { FlowErrorBoundary };
