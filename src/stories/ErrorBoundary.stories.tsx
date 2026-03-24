import { Alert, Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useRef } from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

export default {
  title: "Flow/ErrorBoundary",
};

function Step1() {
  const { advance } = useStep();
  return (
    <Stack>
      <Title order={4}>Step 1 — Welcome</Title>
      <Text c="dimmed">This is the first step of the flow.</Text>
      <Group justify="flex-end">
        <Button onClick={() => advance(() => BrokenStep)}>Next →</Button>
      </Group>
    </Stack>
  );
}

function BrokenStep(): never {
  throw new Error("Oops — this step is broken!");
}

function RecoveryStep(): React.ReactElement {
  return (
    <Stack>
      <Title order={4}>Recovered</Title>
      <Text c="dimmed">The flow recovered to a safe step.</Text>
    </Stack>
  );
}

function Host() {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();
  return (
    <Paper withBorder p="xl" maw={400} mx="auto" mt="xl" radius="md">
      <FlowOutlet
        ref={ref}
        errorFallback={
          <Alert color="red" title="Something went wrong">
            <Text size="sm" mb="sm">
              A step encountered an error.
            </Text>
            <Button
              size="xs"
              variant="white"
              color="red"
              onClick={() => ref.current?.activate(() => RecoveryStep)}
            >
              Recover
            </Button>
          </Alert>
        }
      >
        <Stack>
          <Text c="dimmed">
            Click the button below. Step 2 will throw an error caught by the error boundary.
          </Text>
          <Button variant="light" fullWidth onClick={() => initFlow(() => Step1, ref)}>
            Start Flow
          </Button>
        </Stack>
      </FlowOutlet>
    </Paper>
  );
}

export const Default = {
  render: () => <Host />,
};
