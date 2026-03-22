Feature: Chrome and flow context

  FlowOutlet accepts an optional chrome render prop. Chrome receives the step slot as
  its argument, can wrap or compose around it, stays mounted across step transitions,
  and can read flow context.

  Scenario: Chrome receives step slot and renders it
    Given a host with FlowOutlet configured with a chrome render prop
    When  initFlow is called with a sync step
    Then  both the chrome and the step are visible

  Scenario: Chrome persists across step advancement
    Given a host with FlowOutlet configured with a chrome render prop
    And   the flow has been activated with a sync step
    When  the step advances to a new step
    Then  the chrome component is still visible
    And   the new step is rendered

  Scenario: Chrome reads patched consumer context
    Given a host with FlowOutlet configured with a chrome render prop that displays context
    And   the flow has been activated with initial context
    When  the step advances with a contextPatch
    Then  the chrome component displays the updated context value

  Scenario: Outlet renders without chrome
    Given a host with FlowOutlet configured without chrome
    When  initFlow is called with a sync step
    Then  only the step content is rendered
