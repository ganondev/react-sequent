Feature: Idle children

  FlowOutlet accepts optional children that render when the outlet is idle.
  Children are replaced by the active step when a flow starts,
  and reappear when the flow resolves or aborts.

  Scenario: Outlet renders children when idle
    Given a host with FlowOutlet containing children
    Then  the children are visible

  Scenario: Children are replaced by the active step when a flow starts
    Given a host with FlowOutlet containing children
    When  initFlow is called with a sync step
    Then  the children are not visible
    And   the step is rendered

  Scenario: Children reappear after the flow resolves
    Given a host with FlowOutlet containing children
    And   a flow has been activated
    When  the flow resolves
    Then  the children are visible again

  Scenario: Outlet with no children renders nothing when idle
    Given a host with FlowOutlet and no children
    Then  the outlet renders nothing
