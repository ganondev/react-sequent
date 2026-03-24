import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useRef } from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

export default {
  title: "Flow/BasicFlow",
};

function Step1() {
  const { advance } = useStep();
  return (
    <Stack>
      <Title order={4}>Step 1 — Welcome</Title>
      <Text c="dimmed">This is the first step of the flow.</Text>
      <Group justify="flex-end">
        <Button onClick={() => advance(() => Step2)}>Next →</Button>
      </Group>
    </Stack>
  );
}

function Step2() {
  const { retreat, resolve } = useStep();
  return (
    <Stack>
      <Title order={4}>Step 2 — Confirm</Title>
      <Text c="dimmed">Review and confirm before finishing.</Text>
      <Group justify="space-between">
        <Button variant="subtle" onClick={() => retreat()}>
          ← Back
        </Button>
        <Button color="green" onClick={() => resolve()}>
          Finish ✓
        </Button>
      </Group>
    </Stack>
  );
}

function Host() {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();

  return (
    <Paper withBorder p="xl" maw={400} mx="auto" mt="xl" radius="md">
      <FlowOutlet ref={ref}>
        <Stack>
          <Text c="dimmed">Click the button below to start a two-step flow.</Text>
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
