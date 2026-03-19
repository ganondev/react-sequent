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
