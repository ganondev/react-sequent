Feature: Async step loading

  SequentOutlet wraps the active step in a Suspense boundary.
  Async step loaders show the fallback while loading; sync loaders render immediately.

  Scenario: Async loader shows fallback then renders the step
    Given a host with SequentOutlet configured with a fallback
    When  init is called with an async step loader
    Then  the fallback is shown during loading
    And   the step renders after loading completes

  Scenario: Sync loader renders immediately with no fallback
    Given a host with SequentOutlet configured with a fallback
    When  init is called with a sync step loader
    Then  the step renders immediately
    And   the fallback is never shown
