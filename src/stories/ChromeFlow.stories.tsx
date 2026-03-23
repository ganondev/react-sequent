import { Button, Center, Divider, Group, Loader, Paper, Stack, Text, Title } from "@mantine/core";
import { useRef } from "react";
import { FlowOutlet, type FlowOutletHandle } from "../components/FlowOutlet";
import { useFlowContext } from "../hooks/useFlowContext";
import { useFlowInit } from "../hooks/useFlowInit";
import { useStep } from "../hooks/useStep";

export default {
  title: "Flow/ChromeFlow",
};

/* ------------------------------------------------------------------ */
/*  Chrome — lives inside <FlowOutlet> children, outside Suspense     */
/* ------------------------------------------------------------------ */

function ModalHeader() {
  const { context: ctx } = useFlowContext<{ title: string }>();
  return (
    <>
      <Title order={3}>{ctx.title}</Title>
      <Divider my="sm" />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Step components                                                    */
/* ------------------------------------------------------------------ */

function StepWelcome() {
  const { advance } = useStep();
  return (
    <Stack>
      <Text>Welcome! This is the first step of the flow.</Text>
      <Text c="dimmed" size="sm">
        When you click "Next" the title in the chrome header will update to "Details" while the next
        step loads asynchronously (≈ 800 ms).
      </Text>
      <Group justify="flex-end">
        <Button onClick={() => advance(loadStepDetails, { title: "Details" })}>Next →</Button>
      </Group>
    </Stack>
  );
}

function StepDetails() {
  const { advance, retreat } = useStep();
  return (
    <Stack>
      <Text>Please review the details below.</Text>
      <Text c="dimmed" size="sm">
        Clicking "Next" updates the chrome title to "Confirmation" and triggers a longer async load
        (≈ 2 000 ms). Notice the header stays put while the loader spins.
      </Text>
      <Group justify="space-between">
        <Button variant="subtle" onClick={() => retreat()}>
          ← Back
        </Button>
        <Button onClick={() => advance(loadStepConfirmation, { title: "Confirmation" })}>
          Next →
        </Button>
      </Group>
    </Stack>
  );
}

function StepConfirmation() {
  const { retreat, resolve } = useStep();
  return (
    <Stack>
      <Text>All done — everything looks good!</Text>
      <Text c="dimmed" size="sm">
        The chrome header now reads "Confirmation" and remained stable during both async transitions
        regardless of their different durations.
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

/* ------------------------------------------------------------------ */
/*  Async step loaders with different simulated delays                 */
/* ------------------------------------------------------------------ */

const loadStepWelcome = () =>
  new Promise<{ default: typeof StepWelcome }>((resolve) => {
    setTimeout(() => resolve({ default: StepWelcome }), 800);
  });

const loadStepDetails = () =>
  new Promise<{ default: typeof StepDetails }>((resolve) => {
    setTimeout(() => resolve({ default: StepDetails }), 800);
  });

const loadStepConfirmation = () =>
  new Promise<{ default: typeof StepConfirmation }>((resolve) => {
    setTimeout(() => resolve({ default: StepConfirmation }), 2000);
  });

/* ------------------------------------------------------------------ */
/*  Host — wires everything together                                   */
/* ------------------------------------------------------------------ */

function Host() {
  const ref = useRef<FlowOutletHandle>(null);
  const { initFlow } = useFlowInit();

  return (
    <Stack maw={440} mx="auto" mt="xl">
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
        chrome={(children) => (
          <Paper withBorder p="xl" radius="md">
            <Stack>
              <ModalHeader />
              {children}
            </Stack>
          </Paper>
        )}
      >
        <Paper withBorder p="xl" radius="md">
          <Stack>
            <Text c="dimmed">
              Click the button below to start a chrome flow with async step transitions and a
              persistent header.
            </Text>
            <Button
              variant="light"
              fullWidth
              onClick={() => initFlow(loadStepWelcome, ref, { title: "Welcome" })}
            >
              Start Flow
            </Button>
          </Stack>
        </Paper>
      </FlowOutlet>
    </Stack>
  );
}

export const Default = {
  render: () => <Host />,
};
