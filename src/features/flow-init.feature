Feature: Flow initialization

  The host component uses useFlowInit to start a flow.
  The flow renders in the associated FlowOutlet.

  Scenario: Initialize a basic flow
    Given a host component with useFlowInit and FlowOutlet
    When  initFlow is called with a sync step loader
    Then  the step renders inside the outlet

  Scenario: Initialize a flow with initial context
    Given a host component with useFlowInit and FlowOutlet
    When  initFlow is called with a step loader and initial context
    Then  the step can read the context via useStep
