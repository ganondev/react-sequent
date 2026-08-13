Feature: Animated step transitions

  The host component passes a `transition` render prop to SequentOutlet.
  The outlet keeps both the exiting and entering step mounted during the
  exit animation, then unmounts the previous step when the consumer
  signals completion via `onExited`.

  Scenario: Initial step renders without a transition
    Given a host with a transition render prop
    When  init is called with a sync step loader
    Then  the transition slot is invoked with phase "exited"
    And   previousStep is null
    And   the step is visible in the DOM

  Scenario: Advance triggers a dual-mount transition
    Given a host with a transition render prop
    And   a flow on step A with an "Advance" button to step B
    When  the user clicks "Advance"
    Then  the transition slot is invoked with phase "exiting"
    And   previousStep contains step A
    And   nextStep contains step B
    And   both step A and step B are present in the DOM

  Scenario: onExited completes the transition
    Given a host with a transition render prop
    And   a flow is in the "exiting" phase transitioning from step A to step B
    When  the consumer calls onExited
    Then  the transition slot is invoked with phase "exited"
    And   previousStep is null
    And   step A is no longer in the DOM
    And   step B remains visible

  Scenario: Resolve during transition tears down both steps
    Given a host with a transition render prop
    And   a flow is in the "exiting" phase where the entering step has a "Resolve" button
    When  the user clicks "Resolve"
    Then  both the exiting step and the entering step are removed from the DOM
    And   the outlet returns to idle

  Scenario: Abort during transition tears down both steps
    Given a host with a transition render prop
    And   a flow is in the "exiting" phase where the entering step has an "Abort" button
    When  the user clicks "Abort"
    Then  both the exiting step and the entering step are removed from the DOM
    And   the outlet returns to idle

  Scenario: Entering step can queue a navigation during exit
    Given a host with a transition render prop
    And   a flow is in the "exiting" phase transitioning from step A to step B
    And   step B has a "Queue Next" button that advances to step C
    When  the user clicks "Queue Next"
    And   the consumer calls onExited
    Then  a new transition begins from step B to step C
    And   after calling onExited again, step C is the settled step

  Scenario: Navigation from the entering step mount effect starts a new transition
    Given a host with a transition render prop
    And   a flow on a step with an "Advance" button to a step that auto-advances when entering
    When  the user clicks "Advance"
    And   the consumer calls onExited
    Then  the transition slot is invoked with phase "exiting"
    And   previousStep contains the entering step
    And   the auto-advanced step is mounted as the nextStep

  Scenario: No transition prop behaves identically to legacy mode
    Given a host without a transition render prop
    And   a flow on a step with an "Advance" button to another step
    When  the user clicks "Advance"
    Then  the new step appears immediately
    And   the old step is no longer in the DOM

  Scenario: Chrome survives across transitions
    Given a host with a transition render prop and a chrome wrapper
    And   a flow on step A with an "Advance" button to step B
    When  the user clicks "Advance"
    Then  the chrome wrapper element remains in the DOM
    And   the chrome wrapper is not remounted
