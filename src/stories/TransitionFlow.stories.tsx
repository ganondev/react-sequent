import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";
import {
  type CrossfadeOptions,
  crossfade,
  type SlideOptions,
  slide,
  type TransitionSlotProps,
} from "../transitions";

export default {
  title: "Flow/TransitionFlow",
};

/* ─── Step components ──────────────────────────────────────────────── */

function Step1() {
  const { advance } = useSequentStep();
  return (
    <Stack>
      <Title order={4}>Step 1 — Welcome</Title>
      <Text c="dimmed">This step will crossfade into the next.</Text>
      <Group justify="flex-end">
        <Button onClick={() => advance(() => Step2)}>Next →</Button>
      </Group>
    </Stack>
  );
}

function Step2() {
  const { retreat, advance } = useSequentStep();
  return (
    <Stack>
      <Title order={4}>Step 2 — Confirm</Title>
      <Text c="dimmed">Review and continue, or go back.</Text>
      <Group justify="space-between">
        <Button variant="subtle" onClick={() => retreat()}>
          ← Back
        </Button>
        <Button onClick={() => advance(() => Step3)}>Next →</Button>
      </Group>
    </Stack>
  );
}

function Step3() {
  const { retreat, resolve } = useSequentStep();
  return (
    <Stack>
      <Title order={4}>Step 3 — Done</Title>
      <Text c="dimmed">All steps complete.</Text>
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

/* ─── Hosts ────────────────────────────────────────────────────────── */

function CrossfadeHost({ transition }: { transition: (props: TransitionSlotProps) => ReactNode }) {
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      {/* Ready-made crossfade from react-sequent/transitions. */}
      <SequentOutlet transition={transition}>
        <Stack>
          <Text c="dimmed">Crossfade transition between steps.</Text>
          <Button fullWidth onClick={() => init(() => Step1)}>
            Start Flow
          </Button>
        </Stack>
      </SequentOutlet>
    </Paper>
  );
}

function SequentialHost({ transition }: { transition: (props: TransitionSlotProps) => ReactNode }) {
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      {/* Plain slide by default — fade: true is shown in the modal docs demo. */}
      <SequentOutlet transition={transition}>
        <Stack>
          <Text c="dimmed">Sequential exit-then-enter transition.</Text>
          <Button fullWidth onClick={() => init(() => Step1)}>
            Start Flow
          </Button>
        </Stack>
      </SequentOutlet>
    </Paper>
  );
}

/* ─── Exports ──────────────────────────────────────────────────────── */

export const Crossfade = {
  render: (args: CrossfadeOptions) => <CrossfadeHost transition={crossfade(args)} />,
  args: {
    duration: 300,
    easing: "ease",
  },
  argTypes: {
    duration: { control: "number" },
    easing: { control: "text" },
  },
};

export const Sequential = {
  render: (args: SlideOptions) => <SequentialHost transition={slide(args)} />,
  args: {
    duration: 300,
    easing: "ease",
    fade: false,
    distance: 24,
  },
  argTypes: {
    duration: { control: "number" },
    easing: { control: "text" },
    fade: { control: "boolean" },
    distance: { control: "number" },
  },
};
