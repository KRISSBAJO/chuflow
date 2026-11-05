# General approval workflows

General requests are available from Approvals → General requests. Existing attendance, expense and workspace approvals continue using their existing processes. General request approval does not post a finance ledger entry, approve attendance, or implement personnel changes.

## Configure

Overall and national administrators configure routes at `/approvals/routes`. National administrators can configure only their own national area. Each route has a name, category, final level, currency, review deadline and optional amount threshold with a higher final level. No approval policy is silently seeded: the organization chooses where each category ends.

Routes proceed Church → Area → Zone → District → National, stopping at their designated endpoint. Missing intermediate placements are skipped. A missing final placement, inactive configured level, missing reviewer, inconsistent hierarchy or self-only reviewer prevents submission. Church reviewers are active resident pastors and branch administrators other than the requester. Area/zonal/district reviewers use active headquarters resident pastor appointments. National reviewers are active national pastors in that national area. A national administrator is not automatically a national pastor.

## Lifecycle

Staff choose a church and configured route, enter details, amount and up to ten HTTPS supporting-document links, and can preview the named reviewers before submission. Each intermediate action records a recommendation. Only the final stage approves. Reviewers may reject or return for correction. Requesters may withdraw open/returned requests or edit and resubmit returned requests. Resubmission restarts review against the current policy and preserves prior submitted content and decisions. Final reviewers may explicitly escalate to a higher final level with a recorded reason.

Every decision uses an atomic revision check; two reviewers cannot both advance the same revision. Requesters cannot review their own requests. Holding multiple pastoral appointments does not merge legally distinct stages; the pastor records each stage separately. Notification recipients are deduplicated by account ID per request revision, regardless of overlapping appointments.

Request visibility is limited to the requester, current eligible reviewers, previous decision participants and the overall administrator, constrained by current church access. Snapshot assignment alone does not preserve reviewer access after removal. Live appointments are rechecked for decisions. If the route changes mid-review, an overall administrator can return the request for correction/rerouting, but cannot approve on behalf of an assigned pastor.

## Notifications and operations

A minute worker recovers unscheduled notification jobs from request revisions in batches. Email contains only a generic update and authenticated detail link. Placeholder example.com addresses are skipped. SMTP configuration and real active email addresses are required. Jobs use a database lease, logical deduplication and up to five delivery attempts; SMTP delivery can be at-least-once if a worker stops after sending but before recording success. Overdue reviewers receive daily reminders. No timeout grants approval or bypasses required levels.

The request route, original/revised submission snapshots and decision history are stored in the request. Route configuration changes retain a policy history. Files are linked, not uploaded or made public by this module. Delegation, governing-body committee voting and conversion of legacy expense/attendance queues are separate extensions, not enabled by these routes.
