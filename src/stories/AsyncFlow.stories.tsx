import { Button, Center, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { useRef } from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

export default {
  title: "Flow/AsyncFlow",
};

function AsyncStep1() {
  const { advance } = useStep();
  return (
    <Stack>
      <Title order={4}>Step 1 — Welcome (async)</Title>
      <Text c="dimmed">This step was loaded asynchronously with a simulated delay.</Text>
      <Group justify="flex-end">
        <Button onClick={() => advance(loadAsyncStep2)}>Next →</Button>
      </Group>
    </Stack>
  );
}

function AsyncStep2() {
  const { retreat, resolve } = useStep();
  return (
    <Stack>
      <Title order={4}>Step 2 — Confirm (async)</Title>
      <Text c="dimmed">
        This step was also loaded asynchronously. Pressing back returns instantly (sync retreat).
      </Text>
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

const loadAsyncStep1 = () =>
  new Promise<{ default: typeof AsyncStep1 }>((resolve) => {
    setTimeout(() => resolve({ default: AsyncStep1 }), 1500);
  });

const loadAsyncStep2 = () =>
  new Promise<{ default: typeof AsyncStep2 }>((resolve) => {
    setTimeout(() => resolve({ default: AsyncStep2 }), 1500);
  });

function Host() {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();
  return (
    <Paper withBorder p="xl" maw={400} mx="auto" mt="xl" radius="md">
      <FlowOutlet
        ref={ref}
        fallback={
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Loader size="md" />
              <Text c="dimmed" size="sm">
                Loading step…
              </Text>
            </Stack>
          </Center>
        }
      >
        <Stack>
          <Text c="dimmed">
            Click the button below to start an async flow with simulated loading delays.
          </Text>
          <Button variant="light" fullWidth onClick={() => initFlow(loadAsyncStep1, ref)}>
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
