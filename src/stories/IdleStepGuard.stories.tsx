/**
 * StepBoundary — demonstrates that useSequentStep() throws immediately when
 * called outside the active step's subtree (idle children or chrome).
 *
 * useSequentStep() is only valid inside a rendered step component. Any
 * component outside that boundary — including chrome and idle SequentOutlet
 * children — should use useSequentContext() instead.
 */
import {
  Alert,
  Badge,
  Button,
  Code,
  Divider,
  Group,
  Paper,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { Component, type ReactNode, useState } from "react";
import { useSequentContext } from "../hooks/useSequentContext";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";

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
  { children: ReactNode; reset?: boolean },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; reset?: boolean }) {
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
  useSequentStep(); // throws immediately — no StepContext present here
  return <div>This never renders</div>;
}

/* ------------------------------------------------------------------ */
/*  Correct: useSequentContext() in an idle child                      */
/* ------------------------------------------------------------------ */

function IdleChildCorrect() {
  const { context } = useSequentContext<{ note?: string }>();
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
  const { resolve } = useSequentStep();
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
  const { init, SequentOutlet } = useSequentFlow();
  const [showMisuse, setShowMisuse] = useState(false);
  const [errorKey, setErrorKey] = useState(0);

  const startFlow = () => {
    // Reset misuse demo and start a flow with initial context so the
    // idle child can display a non-undefined value after the flow resolves.
    setShowMisuse(false);
    setErrorKey((k) => k + 1);
    init(() => ActiveStep, { note: "demo flow" });
  };

  return (
    <Paper withBorder p="xl" maw={560} mx="auto" mt="xl" radius="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={4}>Step Boundary Enforcement</Title>
          <Badge color="violet" variant="light">
            useSequentStep() is step-only
          </Badge>
        </Group>

        <Divider label="Misuse — triggers immediate render error" labelPosition="left" />

        <Text size="sm">
          Clicking the button below mounts a component that calls <Code>useSequentStep()</Code>
          outside of a step. It throws immediately at render time. The ErrorBoundary catches it and
          shows the error.
        </Text>

        <Button
          size="xs"
          variant="light"
          onClick={() => {
            setErrorKey((k) => k + 1);
            setShowMisuse(true);
          }}
        >
          Click to call useSequentStep() outside a step boundary
        </Button>

        {showMisuse && (
          <ErrorBoundary key={errorKey}>
            <IdleChildMisuse />
          </ErrorBoundary>
        )}

        <Divider
          label="Correct usage — useSequentContext() in idle child"
          labelPosition="left"
          mt="md"
        />

        <Text size="sm">
          The outlet below uses <Code>useSequentContext()</Code> in its idle child. It renders fine
          and updates after a flow resolves.
        </Text>

        <SequentOutlet>
          <IdleChildCorrect />
          <Button size="xs" variant="filled" onClick={startFlow} mt="sm">
            Start a valid flow →
          </Button>
        </SequentOutlet>
      </Stack>
    </Paper>
  );
}

export const Default = {
  render: () => <Host />,
};
