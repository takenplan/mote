# CI responsibilities

`component-checks.yml` selects affected components for PRs and main. `checks.yml` is the optional broad manual workflow. Keep affected checks and release qualification distinct; documentation-only changes do not build applications.

Develop with focused local checks. After candidate convergence inspect `npm run check:affected -- --dry-run` and complete its plan plus affected journeys. CI checks the pushed revision. Avoid a second blanket local suite duplicating unchanged successful work; never call a local-only result a CI pass.

At recovery start on 2026-10-23 both check workflows were `disabled_manually`; release workflows were active. The owner authorized restoring affected PR checks. Verify enabling and actual runs separately: YAML triggers alone do not prove a workflow is enabled.

The PR owner reads failure logs and repairs ordinary failures with the module owner. Store full logs in CI artifacts or ignored local files. Summarize status, duration and log location; preserve nonzero exit status when showing failure excerpts.

Public API, shared protocol, persistence and authorization changes require their actual consumers. Native packaging, physical devices and live providers are additional checks when relevant. New releases use new versions and immutable tags; rollback never authorizes overwriting a release.

See [testing](testing.md) and [releasing](releasing.md).
