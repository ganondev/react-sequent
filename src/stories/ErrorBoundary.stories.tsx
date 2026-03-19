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
        <Button onClick={() => advance(BrokenStep)}>Next →</Button>
      </Group>
    </Stack>
  );
}

function BrokenStep(): never {
  throw new Error("Oops — this step is broken!");
}

function Host() {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();
  return (
    <Paper withBorder p="xl" maw={400} mx="auto" mt="xl" radius="md">
      <Stack>
        <FlowOutlet
          ref={ref}
          errorFallback={
            <Alert color="red" title="Something went wrong">
              A step encountered an error. The flow cannot continue.
            </Alert>
          }
        />
        <Button variant="light" fullWidth onClick={() => initFlow(Step1, ref)}>
          Start Flow
        </Button>
      </Stack>
    </Paper>
  );
}

export const Default = {
  render: () => <Host />,
};
