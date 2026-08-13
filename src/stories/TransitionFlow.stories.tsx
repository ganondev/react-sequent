import { Button, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { type ReactNode } from "react";
import { useSequentFlow } from "../hooks/useSequentFlow";
import { useSequentStep } from "../hooks/useSequentStep";
import type { TransitionSlotProps } from "../components/FlowOutlet";

export default {
  title: "Flow/TransitionFlow",
};

/* ─── CSS keyframes (library-agnostic) ─────────────────────────────── */

const fadeStyles = `
@keyframes sequent-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes sequent-fade-out {
  from { opacity: 1; }
  to   { opacity: 0; }
}
@keyframes sequent-slide-in-right {
  from { opacity: 0; transform: translateX(24px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes sequent-slide-out-left {
  from { opacity: 1; transform: translateX(0); }
  to   { opacity: 0; transform: translateX(-24px); }
}
`;

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

/* ─── Transition wrappers ──────────────────────────────────────────── */

const DURATION_MS = 300;

/** Crossfade: both steps visible simultaneously, old fades out, new fades in.
 *
 *  `transitionKey` is attached as a React `key` on each animation wrapper so
 *  back-to-back queued transitions remount the wrappers — otherwise React
 *  reuses the DOM nodes, the CSS animations never restart, and `onExited`
 *  never fires again. */
function crossfadeTransition({
  previousStep,
  nextStep,
  phase,
  onExited,
  transitionKey,
}: TransitionSlotProps): ReactNode {
  if (phase === "exited") return nextStep;

  return (
    <div style={{ position: "relative" }}>
      <style>{fadeStyles}</style>
      <div
        key={`exit-${transitionKey}`}
        style={{
          position: "absolute",
          inset: 0,
          animation: `sequent-fade-out ${DURATION_MS}ms ease forwards`,
        }}
        onAnimationEnd={onExited}
      >
        {previousStep}
      </div>
      <div
        key={`enter-${transitionKey}`}
        style={{ animation: `sequent-fade-in ${DURATION_MS}ms ease` }}
      >
        {nextStep}
      </div>
    </div>
  );
}

/** Sequential: old slides out left, then new slides in from right. */
function sequentialTransition({
  previousStep,
  nextStep,
  onExited,
  transitionKey,
}: TransitionSlotProps): ReactNode {
  return (
    <div style={{ position: "relative", overflow: "hidden" }}>
      <style>{fadeStyles}</style>
      {previousStep && (
        <div
          key={`exit-${transitionKey}`}
          style={{
            animation: `sequent-slide-out-left ${DURATION_MS}ms ease forwards`,
          }}
          onAnimationEnd={onExited}
        >
          {previousStep}
        </div>
      )}
      {!previousStep && (
        <div
          key={`enter-${transitionKey}`}
          style={{ animation: `sequent-slide-in-right ${DURATION_MS}ms ease` }}
        >
          {nextStep}
        </div>
      )}
    </div>
  );
}

/* ─── Hosts ────────────────────────────────────────────────────────── */

function CrossfadeHost() {
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      <SequentOutlet transition={crossfadeTransition}>
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

function SequentialHost() {
  const { init, SequentOutlet } = useSequentFlow();

  return (
    <Paper withBorder p="xl" maw={420} mx="auto" mt="xl" radius="md">
      <SequentOutlet transition={sequentialTransition}>
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
  render: () => <CrossfadeHost />,
};

export const Sequential = {
  render: () => <SequentialHost />,
};
