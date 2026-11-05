# Meetings

Open **Meetings** from the Services menu. Leadership starts in **Group settings** (also linked from Service units as **Meeting requirements**).

1. Add a meeting group, select its branch, and optionally link an existing service unit.
2. Enable the group. Choose whether minutes are required and a deadline of 1–720 hours after each meeting.
3. Assign staff users as submitters and reviewers. Submitters can schedule meetings, record attendance, attach documents and submit minutes. Reviewers can approve or return minutes with comments. Leadership has these permissions within its existing branch/district/national scope.
4. Schedule a meeting with a start/end time, agenda, venue and optional Zoom/Google Meet/Teams URL. Admins can choose **Church / general meeting** without first configuring a minutes group; a branch-level general group is created with minutes optional. Configured group requirements still apply when a group is selected. Staff attendees receive access in ChuFlow. Members without logins can have attendance recorded by the organiser/submitter.
5. Open a meeting to record attendance, write minutes, upload a document or attach links. Submit saves the current minutes text and links, then locks the minutes for review. Returned minutes can be corrected and resubmitted. Approved minutes stay locked.
6. Assign action items to staff attendees with optional deadlines. Organisers/submitters can reassign or remove actions; attendees can complete/reopen only their own actions.

## Scheduling and reminders

- Dates entered in the scheduling form use the operator's local timezone and are stored as UTC instants. Meeting summaries explicitly show UTC. Meetings are at most 24 hours long.
- ICS calendar downloads contain UTC dates, venue, agenda and the attached meeting link.
- In-app alerts surface meetings in the next 24 hours, overdue required minutes, submitted minutes awaiting review, and the current user's overdue actions.
- Meeting attendance is independent of church service attendance. Staff and member entries are counted separately; a person recorded in both is not automatically deduplicated.
- Requirements/deadlines are saved on each meeting. Group setting changes affect new meetings. Rescheduling retains the meeting's original submission allowance. Disabling a group blocks new scheduling while preserving existing records.

## Records and exports

- Search, branch/group/status/date filters, minutes filters, upcoming and overdue-action filters, sorting and server pagination are available in the meeting directory.
- Excel/CSV exports include all matching pages, not just the current page, using the same access controls. CSV can be imported into Google Sheets.
- PDF, DOCX and TXT files are limited to 5 MB each and 10 per meeting. Documents are stored in MongoDB, not Render's temporary filesystem. Downloads require authenticated access to the meeting. File contents are excluded from normal queries/responses. Draft attachments can be removed; submitted/approved attachments cannot be changed.
- Saves use an expected revision, rejecting stale writes. The latest 30 minutes text/link revisions and review decisions are retained; this is an operational review trail, not a formal digital-signature certification.
- No video provider credentials, new environment variables, or external meeting infrastructure are required. Users supply their meeting URLs. The application uses the existing SMTP provider for invitations and does not run a built-in video room.

## Validation

Unit/schema and HTTP tests cover branch and meeting permissions, disabled groups, date validation, deadline snapshots, attendance validation, action ownership, stale saves, minutes transitions, document access, multipart upload limits and paginated exports. Production API and web builds must pass before release. These checks do not establish a live Render deployment or real-browser end-to-end validation.

## Meeting audience and email invitations

- Member suggestions appear as you type, with a 250 ms debounce, request cancellation and server pagination. Search accepts name parts or email.
- Choose individual members, all active members of selected service groups, or all active church/branch members. Add other members individually. Both current multiple-service-group assignments and legacy single-group placement are supported. Extra individuals can be selected even when inactive.
- Group and church audiences are expanded to a member snapshot when saved; later group membership changes do not silently add recipients. Saving the meeting again refreshes the selected groups. A maximum of 10,000 members can be selected. All groups and members must be in the meeting branch.
- Audience preview shows unique member count, staff count, unique email addresses and records missing a valid email. Members without addresses remain on the attendance list.
- Email invitations are checked by default for new meetings and can be disabled. Existing meetings do not automatically send invitations unless enabled. Messages include the title, UTC dates, venue, agenda and external join URL.
- Addresses are trimmed and compared case-insensitively. Each member ID is included once; each email address receives at most one application invitation for a meeting, even across member/staff records and selected service groups. Previously sent addresses are not emailed again when the meeting is saved, so edits do not send schedule-update emails to previous recipients.
- An indexed MongoDB outbox persists pending invitations across restarts. Workers atomically claim queued addresses, recheck the current audience and cancellation state, and send in bounded batches every 15 seconds. The meeting page shows preparation, queue, sending, provider-accepted and failure counts. Provider acceptance is not proof of inbox delivery.
- Missing SMTP configuration is reported as failed; authorised organisers/submitters can retry those unsent invitations after configuration is corrected. Interrupted or ambiguous SMTP attempts are marked uncertain and are not automatically retried, preventing application retries from causing duplicate emails. Check the mail provider before taking any further action on uncertain attempts.
