# CORE-HOT-01: hot image capacity and physical listener availability

The independent run on combined core `27a2232b` failed the original 8 → 3 → 8
physical-call scenario: its final 12-second wait observed 19 calls instead of
20. That failed result remains unchanged. The later diagnostic reached all
original business assertions, but its cleanup hook failed after database
removal, so that runner is also not a pass. Neither run recorded OCR listener
indexes; their original failure cannot be conclusively assigned to worker0.

The old fixture nevertheless has a reproducible missing precondition. A owns
nine OCR inputs but only eight listeners, with input8 reusing worker0. Calls
are recorded in handler arrival order. After lowering the global limit to
three, releasing the first five arrivals does not guarantee worker0 is free.
Raising global capacity cannot override its existing physical resource lease.

A bounded generated HTTP barrier records worker0 after the other seven OCR
listeners. The unchanged first-five release then retains workers6,7,0. With no
production edit or timeout increase, the old final assertion fails at exactly
19 calls: A has nine understanding calls and eight OCR calls; B retains one of
each. This proves a valid counterexample to the fixture's unconditional final
expectation, without claiming it reconstructs the original independent run.

The test now covers both contracts explicitly:

- The original global-limit title gives input8 its own ninth A listener and B a
  separate listener. At hot3, that ninth listener is free but the ninth call is
  still refused. Raising to eight reaches all 20 actual calls.
- A reused-listener variant forces the counterexample order. At hot8, its
  ninth OCR child remains waiting with zero attempts and a pinned processor key
  shared by a running same-owner child. Actual calls remain at 19 until the
  held worker0 response is released; then all 20 calls must arrive.

Both variants retain the initial eight physical calls per A kind, B's own
slots, issued-call preservation when lowering, refusal of a ninth call at
hot3, unique generated image inputs, actual OCR and pixel-reading model
children, cancellation, late-response publication fence, successful completion
of the other files and final B isolation assertions. Listener indexes are
bookkept separately from arrival order and included in phase diagnostics.
The original 12-second waits and 120-second per-test runner limit are unchanged.

This is a test-only correction to the existing independent capacity and local
physical-resource contracts. It adds no product limit, lock bypass, policy,
cache assumption or production scheduler change. The preceding File071 native
namespace and OCR-reader fixes remain intact. Focused File-tree results require
an exact later combined-core rebind and independent rerun; they do not turn the
old combined failures or the pending fresh required gate into passes.
