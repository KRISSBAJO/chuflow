# Care, follow-up and member connection

The Follow-up navigation opens `/care`. The previous guest task records remain at `/follow-up`; they are not deleted. The care worker imports guest, member and outreach identities and existing follow-up, visit, communication and individual attendance history in bounded batches. Initial history can take several worker cycles to appear.

## Getting started

1. Open **Follow-up → Automation settings** as a leadership user and choose a branch.
2. Select active branch care workers and an escalation contact. Set capacity, first-contact deadline, retry interval, maximum attempts and worker availability.
3. Review the enablement preview. Save with care automation enabled when the branch is ready. Every branch starts disabled; automated email and attendance signals also start disabled independently.
4. Existing people appear for review but are not enrolled in welcome sequences in bulk. Open an individual record and choose **Start care plan** to enroll an existing person. Newly registered people are eligible after the branch plan is enabled.
5. Enable email separately only after confirming SMTP readiness and recording each person's permission. The settings page shows configured delivery readiness; a successful build does not prove an SMTP provider will accept messages.
6. Enable participation signals only after confirming reliable individual attendance and its start date. Summary headcounts never identify absent members.

## Daily work

The hub has Today, Mine, Unassigned, Overdue, Escalated, Participation gaps and All views, branch/name search, server pagination and Excel/CSV exports. Exports honor the current filters and cover matching pages. Private timeline notes are excluded from exports.

Each person has a named owner, optional backup, next tasks, contact outcomes, language/permission preferences, connection milestones and an append-only timeline. Workers see their assigned, backup, pending handover or delegated-task records within their authorized branch. Leadership can oversee accessible branches. Pastoral notes are leadership-only. A pending handover keeps the current owner responsible until the recipient accepts; the recipient can decline.

The timeline distinguishes a recorded conversation, no answer, callback, help request and a completed task. Sending an email never counts as a successful personal contact, a church visit or attendance. Repeated unanswered attempts escalate for review rather than continuing indefinitely. Group-introduction tasks can reference a service unit; actual membership/formation milestones come from member records.

Guest-to-member and outreach-to-guest links join histories using explicit source IDs. The system does not merge unrelated people merely because names or email addresses match. Source deletion, branch changes, current address, conversion and outreach opt-out are rechecked before outbound email.

## Automation behavior

- Capacity-aware allocation chooses available active branch workers. Unallocated people remain visible for leadership assignment.
- Due tasks generate daily staff reminders. Overdue work can escalate to the selected contact, and an available backup can cover a worker on leave. Notifications use existing push subscriptions; requested dispatch is not proof of device delivery.
- An opted-in guest/outreach welcome sequence can queue messages at enrollment, day 3 and day 7, subject to the branch cap, quiet hours and a 48-hour communication suppression window. Completed conversations, return visits and membership conversion suppress obsolete welcome messages.
- Participation gaps require at least three distinct recorded services in a recent baseline, confirmed coverage and the configured absence interval. The signal explains its evidence and invites a conversation; it is not a prediction or judgment of commitment. Pauses and explained absences suppress signals. New attendance resolves an older gap task.
- Optional retention email uses separate English/Spanish templates and one gentle check-in for a new gap episode. It is disabled independently of other email.
- A weekly Monday leadership briefing summarizes recorded activity. Cohort reports show observed contact within 24 hours, return visits and membership conversion, with denominators shown in the hub. They do not establish that automation caused retention.

Message templates support `{{firstName}}`, `{{churchName}}` and `{{checkInUrl}}`. Suggested conversation wording and care summaries are deterministic, factual aids, not a connected AI service. Phone, SMS and WhatsApp outcomes can be recorded manually; this feature does not add an SMS/WhatsApp sending provider.

## Public check-ins and consent

Private bearer links store only a token hash and expire. Opening a link reveals the church name and form kind, not a person's history or contact details. GET requests never change preferences, so email link scanners cannot unsubscribe someone. Submission consumes the link once. People can request a call/prayer, report travel, set a temporary availability date, set language/email permission or explicitly stop contact. A routine check-in does not create church attendance or imply an opt-out. Prayer text is restricted to leadership.

Recorded global opt-out cancels open contact work and queued messages. Restoring contact permission administratively requires leadership and recorded evidence. Email consent is separate from a request for human contact. Submitted replies are saved before application; interrupted applications are recovered, and pending opt-outs block sending immediately. Used reply payloads expire after 90 days; permanent timeline events remain under the application's existing data governance.

## Reliability and operations

The API worker runs every 30 seconds while the API process is running. MongoDB holds the lease, indexed source cursors, unique task/event/job keys and queued delivery state. Multiple API instances claim jobs atomically. Setup can resume after interruption without resetting sequence dates or creating duplicate tasks. A paused/stopped API resumes pending work when it restarts; this is not a separate always-on scheduling service.

SMTP acceptance is recorded as provider acceptance, not confirmed inbox delivery. A missing provider is a visible failed job that can be retried explicitly. Interrupted or ambiguous sends are marked uncertain and are never replayed automatically. Check the provider before resending uncertain work. There is no bounce/delivery webhook integration in this module.

Branch plan changes use revision checks, as do case updates, to detect stale edits. Durable pending intents preserve timeline/task side effects across failures. Source sync uses `updatedAt`/ID cursors; attendance and overdue processing use bounded resumable batches. Ensure MongoDB index creation is permitted for the added collections and source cursor indexes. No new environment variables or package dependencies are required; existing mail and public web URL configuration is used.

Automation settings are not enabled by deployment. Validate branch configuration and a consenting test record before enabling any live sequence. Browser/live-provider verification is separate from unit, HTTP and production-build validation.
