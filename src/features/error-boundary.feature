Feature: Error boundary

  FlowOutlet wraps the active step in a FlowErrorBoundary.
  A step that throws during render is caught and the errorFallback is shown.

  Scenario: A step that throws renders the errorFallback
    Given a host with FlowOutlet configured with an errorFallback
    When  initFlow is called with a step that throws during render
    Then  the errorFallback is rendered
    And   the throwing step is not visible

  Scenario: The outlet remains mounted after an error
    Given a host with FlowOutlet configured with an errorFallback
    When  initFlow is called with a step that throws during render
    Then  the outlet element is still in the document

  Scenario: Re-activating after an error resets the error boundary
    Given a host with FlowOutlet configured with an errorFallback
    And   the flow has been activated with a step that throws during render
    When  the outlet is re-activated with a healthy step
    Then  the healthy step is rendered
    And   the errorFallback is no longer visible

  Scenario: Tearing down after an error and re-activating shows the new step
    Given a host with FlowOutlet configured with an errorFallback
    And   the flow has been activated with a step that throws during render
    When  the flow is torn down by resolving
    And   the outlet is activated with a healthy step
    Then  the healthy step is rendered

# TODO give error boundary context about the failing transition
# Should be able to demonstrate an error fallback recovering to the previous step or retrying the same transition