/**
 * IdleStepGuard — demonstrates that useStep() transition functions throw
 * an explicit error when called outside an active flow step.
 *
 * The outlet is idle (no active flow), so every useStep() transition
 * function call is invalid and will throw. The story catches the error
 * and surfaces it in the UI instead of silently doing nothing.
 */
import { Alert, Badge, Button, Code, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useState } from "react";
import { useRef } from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

export default {
  title: "Flow/IdleStepGuard",
};

/* ------------------------------------------------------------------ */
/*  An idle child that deliberately tries to call useStep transitions  */
/* ------------------------------------------------------------------ */

function IdleChild({
  onError,
}: {
  onError: (msg: string) => void;
}) {
  const step = useStep();

  function tryCall(fn: () => void) {
    try {
      fn();
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <Stack gap="xs">
      <Text size="sm" c="dimmed">
        This component is an <strong>idle child</strong> rendered inside FlowOutlet while no flow is
        active. Click any button to see the explicit error that useStep() now throws.
      </Text>
      <Group>
        <Button size="xs" variant="light" onClick={() => tryCall(() => step.advance(() => Promise.resolve({ default: () => null })))}>
          advance()
        </Button>
        <Button size="xs" variant="light" onClick={() => tryCall(() => step.retreat())}>
          retreat()
        </Button>
        <Button size="xs" variant="light" onClick={() => tryCall(() => step.resolve())}>
          resolve()
        </Button>
        <Button size="xs" variant="light" onClick={() => tryCall(() => step.abort())}>
          abort()
        </Button>
      </Group>
    </Stack>
  );
}

/* ------------------------------------------------------------------ */
/*  A trivial active step so we can show the non-error case too        */
/* ------------------------------------------------------------------ */

function ActiveStep() {
  const { resolve } = useStep();
  return (
    <Stack>
      <Title order={5}>Active Step</Title>
      <Text c="dimmed" size="sm">
        The flow is now active. Transition functions work normally here.
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
  const [lastError, setLastError] = useState<string | null>(null);

  return (
    <Paper withBorder p="xl" maw={520} mx="auto" mt="xl" radius="md">
      <Stack>
        <Group justify="space-between" align="center">
          <Title order={4}>Idle Step Guard</Title>
          <Badge color="gray" variant="light">
            outlet idle
          </Badge>
        </Group>

        <FlowOutlet ref={ref}>
          <IdleChild onError={setLastError} />
        </FlowOutlet>

        {lastError && (
          <Alert color="red" title="Error thrown by useStep()">
            <Code block style={{ whiteSpace: "pre-wrap", fontSize: 12 }}>
              {lastError}
            </Code>
          </Alert>
        )}

        <Group justify="space-between">
          <Button
            size="xs"
            variant="subtle"
            onClick={() => setLastError(null)}
            disabled={lastError === null}
          >
            Clear error
          </Button>
          <Button
            size="xs"
            variant="filled"
            onClick={() => {
              setLastError(null);
              initFlow(ActiveStep, ref);
            }}
          >
            Start a valid flow →
          </Button>
        </Group>
      </Stack>
    </Paper>
  );
}

export const Default = {
  render: () => <Host />,
};
