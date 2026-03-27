import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";

export default {
  title: "Flow/BasicFlow",
};

function Step1() {
  const { advance } = useSequentStep();
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
  const { retreat, resolve } = useSequentStep();
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
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <Paper withBorder p="xl" maw={400} mx="auto" mt="xl" radius="md">
      <SequentOutlet>
        <Stack>
          <Text c="dimmed">Click the button below to start a two-step flow.</Text>
          <Button variant="light" fullWidth onClick={() => init(() => Step1)}>
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
