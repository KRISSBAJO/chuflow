# Action feedback audit

All transient create/update/action feedback uses the shared Sonner toaster, which appears at the bottom right on desktop and above the bottom navigation on phones.

## Updated areas

| Area | Feedback covered |
| --- | --- |
| Users and account settings | Creation, profile/access updates, password changes; directory save banner removed |
| Branches and structure | Church creation/editing, district/national-area editing, hierarchy placement and appointments |
| Guests and members | Profile updates, return visits, conversion, duplicate merging and creation redirects |
| Service groups and templates | Creation redirects, template save/update actions, QR/share-link copying |
| Communications | Send/log outcomes; provider failures use error toasts and preview mode uses informational toasts |
| Follow-up and care | Activity, care plans, outreach records, follow-up changes, check-in-link creation and copying |
| Meetings | Scheduling/group changes, attendance/minutes/actions, file uploads/removal and invitation retries |
| Approvals | Route saves, submitted requests and review decisions |
| Children | Family/child saves, registration review, session setup, check-in, pickup/supervisor operations, kiosk links and cards |
| Imports and exports | Import review/commit feedback, file/validation failures and download completion |
| Public/auth forms | Connect/intake, care check-in, registration/workspace requests, password reset requests and completion |

## Redirect handling

Creation confirmations reuse the producer’s toast ID so navigation updates a single toast rather than stacking two. The client consumes `created`/`createdName`, `saved` or `submitted` flags after showing the confirmation. It preserves search, filters, pagination, anchors and Next.js history state. Reloading or returning to the page does not replay the success message. A delayed effect cannot change a different page after navigation.

## Intentionally persistent information

Field validation, load/unavailable errors, approval/audience previews, import review/progress, public thank-you/next-step screens, and children’s pickup receipts and safeguarding alerts remain visible. These communicate current state or required next steps rather than a disposable save notification. Their associated mutations also use toasts. Read-only searches/scanning/previews do not show a misleading “saved” notification. Sign-out remains a navigation transition, without a saved-record toast.

## Changed feedback components

- `approval-workflows/decision-form.tsx`
- `approval-workflows/policy-form.tsx`
- `approval-workflows/request-form.tsx`
- `branch-create-form.tsx`
- `branch-detail-panel.tsx`
- `care/care-activity-form.tsx`
- `care/care-check-in.tsx`
- `care/care-detail.tsx`
- `care/care-plan-form.tsx`
- `change-password-form.tsx`
- `children/forms.tsx`
- `children/parent-registration.tsx`
- `children/receipt.tsx`
- `children/registration-review.tsx`
- `children/selection.tsx`
- `children/session-console.tsx`
- `communication-panel.tsx`
- `connect-form.tsx`
- `convert-guest-button.tsx`
- `convert-guest-form.tsx`
- `creation-notice.tsx`
- `district-editor-card.tsx`
- `evangelism/contact-form.tsx`
- `evangelism/follow-up-form.tsx`
- `evangelism/guest-link.tsx`
- `evangelism/link-form.tsx`
- `expense-entry-form.tsx`
- `forgot-password-form.tsx`
- `guest-communication-panel.tsx`
- `guest-create-form.tsx`
- `guest-duplicate-panel.tsx`
- `guest-profile-form.tsx`
- `guest-return-visit-form.tsx`
- `hierarchy-catalog-panel.tsx`
- `hierarchy/workspace.tsx`
- `import-wizard.tsx`
- `meetings/details.tsx`
- `meetings/forms.tsx`
- `member-create-form.tsx`
- `offering-entry-form.tsx`
- `oversight-region-editor-card.tsx`
- `reset-password-form.tsx`
- `service-unit-create-form.tsx`
- `share-link-card.tsx`
- `table-export.tsx`
- `template-editor-card.tsx`
- `template-qr-card.tsx`
- `user-account-editor.tsx`
- `user-create-form.tsx`
- `workspace-request-form.tsx`

Shared additions: `components/action-notice.tsx` (query-driven confirmations) and `lib/action-feedback.ts` (localized default success messages and record toast IDs). Regression tests cover redirect consumption, reload/Strict Mode behavior, navigation races, shared IDs, specific route wording, successful writes and failure-only feedback.
