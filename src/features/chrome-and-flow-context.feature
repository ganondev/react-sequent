Feature: Chrome and flow context

  FlowOutlet renders an optional chrome component alongside the active step.
  Chrome stays mounted across step transitions and can read flow context.

  Scenario: Chrome renders alongside the active step
    Given a host with FlowOutlet configured with a chrome component
    When  initFlow is called with a sync step
    Then  both the chrome and the step are visible

  Scenario: Chrome is not visible before the flow is initialized
    Given a host with FlowOutlet configured with a chrome component
    Then  the chrome is not visible before the flow is initialized

  Scenario: Chrome stays mounted when the step advances
    Given a host with FlowOutlet configured with a chrome component
    And   the flow has been activated with a sync step
    When  the step advances to a new step
    Then  the chrome component is still visible
    And   the new step is rendered

  Scenario: Chrome reads updated context via useFlowContext after a contextPatch
    Given a host with FlowOutlet configured with a chrome component that displays context
    And   the flow has been activated with initial context
    When  the step advances with a contextPatch
    Then  the chrome component displays the updated context value

  Scenario: A step renders without chrome when none is provided
    Given a host with FlowOutlet configured without chrome
    When  initFlow is called with a sync step
    Then  only the step content is rendered
