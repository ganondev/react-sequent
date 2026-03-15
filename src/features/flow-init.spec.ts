import { describeFeature, loadFeature } from "@amiceli/vitest-cucumber";
import { expect } from "vitest";

const feature = await loadFeature("src/features/flow-init.feature");

describeFeature(feature, ({ Scenario }) => {
  Scenario("Initialize a basic flow", ({ Given, When, Then }) => {
    Given("a host component with useFlowInit and FlowOutlet", () => {
      // TODO: render host component with RTL
      expect(true).toBe(true);
    });

    When("initFlow is called with a sync step loader", () => {
      // TODO: call initFlow
      expect(true).toBe(true);
    });

    Then("the step renders inside the outlet", () => {
      // TODO: assert step is visible
      expect(true).toBe(true);
    });
  });

  Scenario("Initialize a flow with initial context", ({ Given, When, Then }) => {
    Given("a host component with useFlowInit and FlowOutlet", () => {
      // TODO: render host component with RTL
      expect(true).toBe(true);
    });

    When("initFlow is called with a step loader and initial context", () => {
      // TODO: call initFlow with context
      expect(true).toBe(true);
    });

    Then("the step can read the context via useStep", () => {
      // TODO: assert context is available
      expect(true).toBe(true);
    });
  });
});
