import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useSequentContext } from "../hooks/useSequentContext";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";

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
      {wasRecovered ? (
        <Alert color="green" title="Flow recovered successfully"/>
      ) : null}
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

function ErrorFallback() {
  const { advance, retreat, abort } = useSequentStep();

  return (
    <Alert color="red" title="Something went wrong">
      <Text size="sm" mb="sm">
        A step encountered an error.
      </Text>
      <Group justify="flex-end">
        <Button size="xs" variant="subtle" color="red" onClick={() => retreat()}>
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
        <Button size="xs" variant="light" color="red" onClick={() => abort("aborted-from-fallback")}>
          Abort!
        </Button>
      </Group>
    </Alert>
  );
}

function IdleContent({ init }: { init: ReturnType<typeof useSequentFlow>["init"] }) {
  const { status } = useSequentContext();

  return (
    <Stack>
      {status === "aborted" ? (
        <Alert color="yellow" title="Flow aborted">
          The flow was aborted and returned to the idle state.
        </Alert>
      ) : null}
      <Text c="dimmed">
        Click the button below. Step 2 will throw an error caught by the error boundary.
      </Text>
      <Button variant="light" fullWidth onClick={() => init(() => Step1)}>
        Start Flow
      </Button>
    </Stack>
  );
}

function Host() {
  const { init, SequentOutlet } = useSequentFlow();
  return (
    <Paper withBorder p="xl" maw={400} mx="auto" mt="xl" radius="md">
      <SequentOutlet errorFallback={<ErrorFallback />}>
        <IdleContent init={init} />
      </SequentOutlet>
    </Paper>
  );
}

export const Default = {
  render: () => <Host />,
};
