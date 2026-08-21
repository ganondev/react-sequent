Feature: Flow lifecycle hook

  The host component passes an `onFlowStarted` prop to SequentOutlet.
  The callback fires once per flow activation with a controls object
  (retreat, abort, getHistoryDepth), and its return value is a cleanup
  function that runs when the flow settles.

  Scenario: onFlowStarted fires once per activation
    Given a host with an onFlowStarted prop
    When  init is called with a sync step loader
    Then  the callback fires exactly once
    And   getHistoryDepth returns 0

  Scenario: getHistoryDepth reflects advances and retreats
    Given a host with an onFlowStarted prop
    And   a flow on step A with an "Advance" button to step B
    When  the user clicks "Advance"
    Then  getHistoryDepth returns 1
    When  the user clicks "Retreat"
    Then  getHistoryDepth returns 0

  Scenario: controls.retreat works in direct mode
    Given a host with an onFlowStarted prop
    And   a flow on step A with an "Advance" button to step B
    When  the user clicks "Advance"
    And   the user clicks "Retreat"
    Then  step A is visible in the DOM
    And   step B is no longer in the DOM

  Scenario: controls.retreat at the first step is a no-op
    Given a host with an onFlowStarted prop
    And   a flow on the first step
    When  the user calls retreat
    Then  no error is thrown
    And   the step remains rendered
    And   getHistoryDepth returns 0

  Scenario: controls.retreat queues during exit transition
    Given a host with a transition render prop and an onFlowStarted prop
    And   a flow is in the "exiting" phase transitioning from step A to step B
    When  the user clicks "Retreat"
    And   the consumer calls onExited
    Then  step A is visible in the DOM
    And   step B is the outgoing step of the new transition

  Scenario: Two rapid retreats during exit transition use last-write-wins
    Given a host with a transition render prop and an onFlowStarted prop
    And   a flow is in the "exiting" phase transitioning from step A to step B
    When  the user clicks "Retreat" twice in rapid succession
    And   the consumer calls onExited
    Then  step A is visible in the DOM

  Scenario: controls.abort fires onAbort and settles
    Given a host with an onFlowStarted prop and an onAbort callback
    When  the user clicks "Abort"
    Then  the onAbort callback fires
    And   the outlet returns to idle
    And   the cleanup function runs exactly once

  Scenario: Post-settle controls are no-ops
    Given a host with an onFlowStarted prop
    And   a flow that has resolved
    When  the user calls retreat on the stale controls
    Then  no error is thrown
    When  the user calls abort on the stale controls
    Then  abort also does not throw
    And   getHistoryDepth returns 0

  Scenario: Cleanup runs on resolve
    Given a host with an onFlowStarted prop
    And   a flow on a step with a "Resolve" button
    When  the user clicks "Resolve"
    Then  the cleanup function runs exactly once

  Scenario: Cleanup runs on abort
    Given a host with an onFlowStarted prop
    And   a flow on a step with an "Abort" button
    When  the user clicks "Abort"
    Then  the cleanup function runs exactly once

  Scenario: Cleanup runs on unmount while active
    Given a host with an onFlowStarted prop
    And   a flow is active
    When  the host unmounts
    Then  the cleanup function runs exactly once

  Scenario: Cleanup runs on re-activation
    Given a host with an onFlowStarted prop
    And   a flow is active
    When  init is called again with a new step loader
    Then  the cleanup function runs exactly once
    And   the callback fires again for the new flow

  Scenario: Prop unset or idle never fires
    Given a host with no onFlowStarted prop
    When  init is called with a sync step loader
    Then  no error is thrown
    And   the outlet renders the step normally

  Scenario: Prop identity changes mid-flow do not re-subscribe
    Given a host with an onFlowStarted prop
    And   a flow is active
    When  the host re-renders with a new onFlowStarted callback
    Then  the callback does not fire again
    And   the original cleanup is not invoked

  Scenario: StrictMode activates a single leak-free subscription
    Given a host with an onFlowStarted prop
    When  the host renders in StrictMode
    And   a flow is activated
    Then  the callback fires exactly once
    When  the flow settles
    Then  the cleanup runs exactly once
    And   no listeners are leaked

  Scenario: Browser-back recipe through public API
    Given a host with an onFlowStarted prop
    And   a flow on step A with an "Advance" button to step B
    When  the user clicks "Advance"
    And   the user presses browser Back
    Then  step A is visible in the DOM
    When  the user presses browser Back again
    Then  the onAbort callback fires
    And   the outlet returns to idle

  Scenario: Post-settle control no-ops after resolve
    Given a host with an onFlowStarted prop
    And   a flow that has resolved
    When  the user calls all three controls
    Then  no errors are thrown
    And   getHistoryDepth returns 0

  Scenario: getHistoryDepth returns 0 at first step and after settle
    Given a host with an onFlowStarted prop
    When  init is called with a sync step loader
    Then  getHistoryDepth returns 0
    When  the flow resolves
    Then  getHistoryDepth returns 0 after settle
