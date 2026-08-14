Feature: Error boundary

  SequentOutlet wraps the active step in a FlowErrorBoundary.
  A step that throws during render is caught and the errorStep is shown.

  Scenario: A step that throws renders the errorStep
    Given a host with SequentOutlet configured with an errorStep
    When  init is called with a step that throws during render
    Then  the errorStep is rendered
    And   the throwing step is not visible

  Scenario: The outlet remains mounted after an error
    Given a host with SequentOutlet configured with an errorStep
    When  init is called with a step that throws during render
    Then  the outlet element is still in the document

  Scenario: Re-activating after an error resets the error boundary
    Given a host with SequentOutlet configured with an errorStep
    And   the flow has been activated with a step that throws during render
    When  the outlet is re-activated with a healthy step
    Then  the healthy step is rendered
    And   the errorStep is no longer visible

  Scenario: Tearing down after an error and re-activating shows the new step
    Given a host with SequentOutlet configured with an errorStep
    And   the flow has been activated with a step that throws during render
    When  the flow is torn down by resolving
    And   the outlet is activated with a healthy step
    Then  the healthy step is rendered

  Scenario: Error step receives the thrown error object
    Given a host with SequentOutlet configured with an errorStep that captures context
    When  init is called with a step that throws during render
    Then  the captured error matches the thrown error

  Scenario: Error step receives the failed step component
    Given a host with SequentOutlet configured with an errorStep that captures context
    When  init is called with a step that throws during render
    Then  the captured failed step matches the throwing step

  Scenario: Error step receives the React component stack
    Given a host with SequentOutlet configured with an errorStep that captures context
    When  init is called with a step that throws during render
    Then  the captured component stack is present

  Scenario: An advance queued from the error UI during an exit transition renders the destination step
    Given a host with a transition render prop and an errorStep whose UI queues an advance
    And   a flow has advanced to a step that throws during render
    When  the user clicks "Queue Next" in the error UI
    And   the consumer calls onExited
    Then  the destination step is rendered
    And   the error UI is no longer visible

  Scenario: A retreat queued from the error UI during an exit transition renders the restored history step
    Given a host with a transition render prop and an errorStep whose UI queues a retreat
    And   a flow has advanced to a step that throws during render
    When  the user clicks "Queue Retreat" in the error UI
    And   the consumer calls onExited
    Then  the restored history step is rendered
    And   the error UI is no longer visible
