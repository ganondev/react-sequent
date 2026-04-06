import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";
import type { ErrorStepContext } from "../internal/FlowErrorBoundary";

export default {
  title: "Flow/ErrorBoundary",
};

function Step1() {
  const { advance } = useSequentStep();
  return (
    <Stack>
      <Title order={4}>Step 1 — Welcome</Title>
      <Text c="dimmed">This is the first step of the flow.</Text>
      <Group justify="flex-end">
        <Button variant="default" onClick={() => advance(() => TerminalStep)}>
          Ok Transition
        </Button>
        <Button onClick={() => advance(() => BrokenStep)}>Bad Transition</Button>
      </Group>
    </Stack>
  );
}

function BrokenStep(): never {
  throw new Error("Oops — this step is broken!");
}

function TerminalStep(): React.ReactElement {
  const { context, resolve } = useSequentStep<{ recovered?: boolean }>();
  const recoveredContext = context as Record<string, unknown> | null;
  const wasRecovered = recoveredContext?.["recovered"] === true;

  return (
    <Stack>
      {wasRecovered ? <Alert color="green" title="Flow recovered successfully" /> : null}
      <Title order={4}>Terminal</Title>
      <Text c="dimmed">The flow reached the terminal step successfully.</Text>
      <Group justify="flex-end">
        <Button variant="light" onClick={() => resolve()}>
          Yay!
        </Button>
      </Group>
    </Stack>
  );
}

function ErrorFallback(props: ErrorStepContext) {
  const { advance, retreat, abort } = useSequentStep();
  const errorMessage =
    props.error instanceof Error ? props.error.message : "A step encountered an unknown error.";
  const failedStepName = props.failedStep.displayName ?? props.failedStep.name ?? "AnonymousStep";

  return (
    <Alert color="red" title="Something went wrong">
      <Text size="sm" mb="sm">
        {errorMessage}
      </Text>
      <Text size="xs" c="dimmed" mb="sm">
        Failed step: {failedStepName} · phase: {props.phase}
      </Text>
      <Group gap="xs">
        <Button size="xs" variant="white" color="red" onClick={() => retreat()}>
          Go back
        </Button>
        <Button
          size="xs"
          variant="white"
          color="red"
          onClick={() => advance(() => TerminalStep, { recovered: true })}
        >
          Recover
        </Button>
        <Button size="xs" variant="white" color="red" onClick={() => abort("Abort!")}>
          Abort!
        </Button>
      </Group>
    </Alert>
  );
}

function Host() {
  const { init, SequentOutlet } = useSequentFlow();

  const handleStart = () => {
    init(() => Step1);
  };

  return (
    <Paper withBorder p="xl" maw={400} mx="auto" mt="xl" radius="md">
      <SequentOutlet errorStep={(context) => <ErrorFallback {...context} />}>
        <Stack>
          <Text c="dimmed">
            Click the button below. Step 2 will throw an error caught by the error boundary.
          </Text>
          <Button variant="light" fullWidth onClick={handleStart}>
            Start Flow
          </Button>
        </Stack>
      </SequentOutlet>
    </Paper>
  );
}

export const Default = {
  render: () => <Host />,
};
