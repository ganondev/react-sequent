/**
 * StepBoundary — demonstrates that useStep() throws immediately when
 * called outside the active step's subtree (idle children or chrome).
 *
 * useStep() is only valid inside a rendered step component. Any component
 * outside that boundary — including chrome and idle FlowOutlet children —
 * should use useFlowContext() instead.
 */
import { Alert, Badge, Button, Code, Divider, Group, Paper, Stack, Text, Title } from "@mantine/core";
import React from "react";
import { Component, useRef, useState } from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowContext } from "../hooks/useFlowContext";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

export default {
  title: "Flow/StepBoundary",
};

/* ------------------------------------------------------------------ */
/*  Simple resettable error boundary                                   */
/* ------------------------------------------------------------------ */

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: React.ReactNode; reset?: boolean },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; reset?: boolean }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  // When the parent passes a new `reset` key, the component remounts and clears the error.
  render() {
    if (this.state.error) {
      return (
        <Alert color="red" title="useStep() — boundary violation">
          <Code block style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
            {this.state.error.message}
          </Code>
        </Alert>
      );
    }
    return this.props.children;
  }
}

/* ------------------------------------------------------------------ */
/*  Misuse: useStep() called outside a step — throws at render time   */
/* ------------------------------------------------------------------ */

function IdleChildMisuse() {
  useStep(); // throws immediately — no StepContext present here
  return <div>This never renders</div>;
}

/* ------------------------------------------------------------------ */
/*  Correct: useFlowContext() in an idle child                         */
/* ------------------------------------------------------------------ */

function IdleChildCorrect() {
  const { context } = useFlowContext<{ note?: string }>();
  return (
    <Text size="sm" c="teal">
      Last resolved context:{" "}
      {context?.note ? (
        <strong>{context.note}</strong>
      ) : (
        <em>undefined (no flow has resolved yet)</em>
      )}
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/*  Active step                                                        */
/* ------------------------------------------------------------------ */

function ActiveStep() {
  const { resolve } = useStep();
  return (
    <Stack>
      <Title order={5}>Active Step</Title>
      <Text c="dimmed" size="sm">
        useStep() works normally inside a rendered step.
      </Text>
      <Button size="xs" color="green" onClick={() => resolve()}>
        Finish flow
      </Button>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  Host                                                               */
/* ------------------------------------------------------------------ */

function Host() {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();
  const [showMisuse, setShowMisuse] = useState(false);
  const [errorKey, setErrorKey] = useState(0);

  const startFlow = () => {
    // Reset misuse demo and start a flow with initial context so the
    // idle child can display a non-undefined value after the flow resolves.
    setShowMisuse(false);
    setErrorKey((k) => k + 1);
    initFlow(ActiveStep, ref, { note: "demo flow" });
  };

  return (
    <Paper withBorder p="xl" maw={560} mx="auto" mt="xl" radius="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={4}>Step Boundary Enforcement</Title>
          <Badge color="violet" variant="light">
            useStep() is step-only
          </Badge>
        </Group>

        <Divider label="Misuse — triggers immediate render error" labelPosition="left" />

        <Text size="sm">
          Clicking the button below mounts a component that calls{" "}
          <Code>useStep()</Code> outside of a step. It throws immediately at
          render time. The ErrorBoundary catches it and shows the error.
        </Text>

        <Button
          size="xs"
          variant="light"
          onClick={() => {
            setErrorKey((k) => k + 1);
            setShowMisuse(true);
          }}
        >
          Click to call useStep() outside a step boundary
        </Button>

        {showMisuse && (
          <ErrorBoundary key={errorKey}>
            <IdleChildMisuse />
          </ErrorBoundary>
        )}

        <Divider label="Correct usage — useFlowContext() in idle child" labelPosition="left" mt="md" />

        <Text size="sm">
          The outlet below uses <Code>useFlowContext()</Code> in its idle
          child. It renders fine and updates after a flow resolves.
        </Text>

        <FlowOutlet ref={ref}>
          <IdleChildCorrect />
          <Button size="xs" variant="filled" onClick={startFlow} mt="sm">
            Start a valid flow →
          </Button>
        </FlowOutlet>

      </Stack>
    </Paper>
  );
}

export const Default = {
  render: () => <Host />,
};
