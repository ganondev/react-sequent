**Overall Assessment**
For the niche it targets, there are a few implementation choices I would consider materially problematic, not just taste-level disagreements.

**Step-loader Normalization Strategy**
The library accepts either a component or an async factory, but normalizeStepLoader() tries to distinguish them by calling plain functions and checking whether the return value is thenable. The source comments explicitly acknowledge that this has side effects, and the implementation does it anyway, falling back only if the call throws. For plain function components, especially ones using hooks, that means the library may invoke a component function outside React just to classify it. Architecturally, that is the wrong boundary: loader detection should never require executing user code. This is the most serious flaw I saw because it makes the API look simpler than the implementation can safely support.

**Imperative Outlet Model**
useFlowInit() requires a ref to an outlet, then calls an imperative activate() handle on that outlet, and returns a promise that resolves or rejects when the flow ends. That works, but it makes the API feel more like mounting a mini runtime than using a React abstraction. It is a reasonable escape hatch, but as the primary API it creates awkwardness around composition, testing, multiple outlets, and ownership. I would have preferred the imperative handle to be the low-level primitive and a declarative wrapper to be the default surface.

**Context Model**
The context model is conceptually clean, but the way context is updated is too magical. advance(nextStep, contextPatch) shallow-merges only when both the previous context and the patch are non-null objects; otherwise it replaces the entire context value. That means the same API sometimes means “patch this object” and sometimes means “overwrite everything,” depending on runtime shape. For a library whose pitch is simplicity, this kind of type/behavior overloading is exactly the sort of thing that becomes surprising later. A reducer-style updater or a stricter “replace only” policy would be easier to reason about.

**History Is Step-Only**
Related to that, history is step-only, not stateful in a stronger sense. The outlet stores history: ComponentType[], pushes the previous step on advance, and on retreat simply restores the previous component while keeping the current consumerContext unchanged. That is a valid opinionated choice, but it means “Back” is really “render the previous step again with the latest context,” not “restore the previous state snapshot.” For short flows that may be fine, but it should be treated as a consequential architectural decision, because many people will assume back-navigation is state-rewinding when it is not.

**Hook Compartmentalization**
The hook compartmentalization is good in principle but a bit too strict in practice. The split between useFlowContext() and useStep() is implemented through two nested contexts so that misuse throws eagerly outside the active step subtree. That is disciplined and internally coherent. But it also means “chrome” components are deliberately second-class citizens: they can resolve or abort a flow, but they cannot navigate with advance or retreat. That may be exactly what the author wants, but it narrows the design space more than the marketing copy suggests.

**Error Boundary**
The error boundary is another place where the implementation feels underpowered relative to the API story. FlowErrorBoundary just stores hasError, renders errorFallback, and componentDidCatch is a no-op. That is acceptable for an alpha, but it means the library does not yet provide much structure around flow failure beyond swapping UI. Since the library already positions itself as async-first and Suspense-based, richer error handling is one of the first places I would expect depth.

**API Honesty / Maturity Constraints**
There is also an API honesty issue around maturity and constraints. The package is still 0.1.0-alpha, requires Node >=24, and pegs peer dependencies to React ^19.0.0. Those constraints can be fine for a hobby or experimental library, but they make the ergonomic promise less broadly usable than it first appears. Combined with the small repo footprint, I would read the current API as an experiment more than a stable abstraction.

**Positive Aspects**
The core architecture has a real point of view. The two-context separation is thoughtful, the stale-flow guard using a monotonically increasing flowIdRef is a good defensive detail, the stable chrome wrapping is clean, and retaining the last consumer context for idle children is a deliberate and coherent choice. So I do not think the project is confused. I think it has one very sharp idea, but the implementation currently cuts one corner that it cannot afford to cut: executing unknown functions to infer whether they are components or async loaders.

**Net Judgment**
The architecture is interesting, the public surface is mostly small and readable, but the current implementation is not yet trustworthy enough for me to treat it as infrastructure. The loader normalization logic alone is a blocker. If that were redesigned, most of my remaining criticisms would drop from “serious” to “opinionated tradeoff.”

**v2 API Note**
Can outline what would change in a v2 API.