# ChuFlow Kids — first release

## Workspace and access

`/children` is a separate children’s workspace, with an illustrated welcome, A–B–C tasks, families, classrooms, attendance and pickup. `children_worker` and `children_supervisor` are branch-scoped roles. After login, both land directly here. The frontend and global API guard prevent these accounts from accessing other app areas, even endpoints decorated for all application roles. Their own account read, logout and password-change endpoints remain available, with a My account screen inside the children’s workspace. Access is rechecked on focus and periodically; role or login changes refresh the workspace.

Church administrators create accounts in Users and explicitly select a children’s role and home branch. Workers can search families during an open session, check children in, view active classroom rosters and perform verified checkout. Supervisors also register/update families and children, issue cards, set up sessions, transfer rooms, replace lost receipts with a recorded reason, export attendance, close sessions and manage kiosks. Existing scoped overall/national/district administrators, branch administrators and resident pastors can supervise. Ordinary access to the member directory does not grant child profile access.

Family and session lists are paginated. The leadership dashboard has a scope-aware summary: registered children, currently present and child service visits during the selected period. Only aggregate counts are returned there. Detailed guardian/care records stay in the protected children’s workspace.

## Family and child registration

Create a family, then its responsible adults. Each adult has a relationship, contact phone, optional email and optional link to an existing adult member of the same church. Guardians do not need membership or login accounts. Add a child with a valid birth date, linked guardians and an explicitly selected pickup list. At least one linked guardian can check in and at least one linked adult can collect. An emergency contact is not automatically a pickup adult. A guardian may collect one sibling but not another.

Care instructions and pickup notes are stored separately from ordinary member data. A photograph requires recorded guardian permission and a HTTPS photo URL. The photo URL should point to an appropriately protected church-managed location; this release links photos rather than uploading them.

A child marked as a member has a safe Member projection using the same ID: name, branch, child record type and membership status. Guardian, birth-date and care information do not enter the general Member record. Projection upserts are idempotent; a retry of a partially completed registration repairs the projection rather than duplicating membership. Generic member editing of these child records is blocked, so identity changes go through the children’s profile. Changing to visitor/inactive does not delete history; it inactivates the member projection. Registration requests carry stable idempotency keys.

## Cards, services and capacity

A supervisor issues a family QR card and can also issue a unique child QR card. Codes are random opaque identifiers with hashed server-side lookup. Replacing a card disables its predecessor. Cards authorize identification for check-in only; they are not pickup credentials. Raw codes are returned once for printing and are not stored as retrievable text.

There is one open session per church, with up to 20 age-ranged classrooms and enforced capacity. The database uses a partial unique index to prevent concurrent open sessions for a branch. Close the previous session after every child has been collected, then open the next service. A session supports up to 1,000 children. All service dates are stored in UTC and displayed in local time. Completed months determine classroom eligibility.

Check-in accepts a scanned card or staff-assisted family search. Staff confirm the adult and choose children/rooms. Siblings are committed together in a single guarded session update. Duplicate or simultaneous scans cannot create duplicate attendance. A child receives one attendance record per session; same-session re-entry after checkout is not part of this release. A classroom transfer changes placement and records an event without adding attendance.

## Pickup and exceptions

Each check-in creates a fresh, high-entropy pickup credential, hashed in the session. The guardian receives a QR receipt; children receive labels with names, rooms and a matching display reference. Labels show only a care-alert indicator, not medical instructions or guardian phone numbers.

Pickup scanning only finds matching children. A worker must select the collecting adult, check the live authorized pickup list, read restrictions and explicitly confirm identity before checkout. A receipt never overrides an unauthorized pickup relationship. Each handover uses an atomic revision comparison; simultaneous checkout attempts cannot both succeed. Checkout clears the child’s pickup hash. A session cannot close while anyone is checked in.

Lost receipts require a supervisor, a documented identity-verification reason and an already-authorized collecting adult. This exception does not grant a new adult pickup permission. Supervisors can issue a replacement receipt for an active child; the old credential stops working for that child. Changes to pickup authorization are checked against the live child record at handover time.

## Public kiosk and devices

A supervisor pairs a kiosk to one session using a temporary opaque capability. It expires at service end or eight hours after pairing, whichever is earlier, and can be revoked. Closing the service also revokes its kiosks. Database-backed request limits constrain scan/check-in attempts. Public kiosks never offer a directory search, guardian contact details, birth dates, care notes or checkout operations. Scanned families see masked child names and only the choices needed to check in.

Use a dedicated browser/OS profile that is not signed into the staff app. A web page cannot lock the physical browser. Idle/reset clears family information and pickup receipts after 90 seconds. Late network results from a previous family are discarded. No family data or receipt is stored in browser local storage.

The welcome flow supports English, Spanish, French and Portuguese; administrative screens currently use English. API error messages follow the API’s current language. A 2D USB/Bluetooth scanner can type into the scan box. Camera scanning is feature-detected and available only where the browser supports the native BarcodeDetector API. Camera permission is requested only after pressing its button, and video streams stop after scanning or leaving the component. There is no frame upload.

Labels and pickup receipts use browser printing. Configure paper size/label stock and test the physical scanner/printer before using the workflow during a real service. No unattended automatic-print or proprietary printer integration is assumed. Internet access is required. During an outage use the church’s documented manual safeguarding/register process; offline synchronization is not implemented.

## Reporting and validation

The session roster is the authoritative children’s attendance record. Its CSV is compatible with Excel/Google Sheets and excludes medical notes and phone numbers. Formula-leading CSV values are escaped. Children’s rosters do not silently append a second headcount to existing general service summaries. Use the unique-child session total when preparing/reconciling the service report.

Automated tests cover roles, scope, age/capacity checks, opaque credentials, duplicate and simultaneous scans, adult confirmation, live pickup permissions, supervisor exceptions, receipt replacement, simultaneous checkout and closure. Chrome walkthrough used synthetic records only: children-only navigation → family selection → check-in/receipt → pickup verification → explicit checkout. No live children’s records or staff accounts were created during development. Hardware printing/scanning and staff safeguarding procedures need an on-site trial.

## Illustration provenance

Project asset: `apps/web/public/children/welcome.png` (original copied into the repository; no external image dependency). Generated with the built-in image generation tool using this final prompt:

> Use case: illustration-story. Create an original premium children's book illustration as a wide landscape welcome-banner asset for a church children's check-in workspace. Diverse happy young children with a friendly adult volunteer arriving at a bright welcoming classroom, books and playful building blocks, a small warm sun and soft curved rainbow shapes. Sophisticated hand-painted paper texture, rounded organic shapes, expressive simple faces, warm cream background, ChuFlow-inspired warm orange with teal, pale sky blue and butter yellow accents. Calm, joyful, reassuring, inclusive. Clean composition with generous breathing room, polished professional product illustration, no text, no typography, no logos, no interface mockup. Suitable to crop as a banner, characters kept centrally composed.

## Parent self-registration

Supervisors can open Children > Parent registration to copy a church-specific public link and QR code, replace the link, or disable it. Parents submit family/adult details followed by children, pickup permissions, care notes and consent without an account. Public submissions do not create active families, issue cards or check children in.

The supervisor queue supports approval after guardian verification and duplicate review, rejection with a reason, or marking an existing family as handled without overwriting its records. Approval creates linked family and child records; membership is optional. Interrupted approvals retain stable record identifiers and can be resumed after ten minutes. The initial parent form is in English.
