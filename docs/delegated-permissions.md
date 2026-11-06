# Delegated permission management

Open **Organization → Permission manager**, or a user’s **Roles & access → Additional permissions**.

- Search the scoped user directory, then choose individual additional permissions.
- Grants default to 30 days. Choose 7 days, a custom expiry, or no expiry.
- A reason is required for granting, renewal and revocation.
- The searchable, paginated ledger shows the recipient, permission, issuer, expiry and status. Open a row’s history for its reason and revocation details.
- Filter by status or grants issued by you; select a user to see their full history.
- Renew/change replaces the previous active grant and retains its history.
- Revoke one grant or all extra access for a selected user. Normal role permissions remain intact.
- Download filtered results across pages as Excel or CSV for Google Sheets.

## Authority boundaries

Only overall, national, district and branch admins, national/district pastors and resident pastors can manage delegation. Area and zonal pastors are resident pastors with an explicitly enabled oversight appointment. Their management authority follows that appointment’s current church scope. Associate pastors and support/children roles do not gain permission management by receiving a feature grant.

Managers cannot modify their own grants, manage a higher-ranked role, or grant access to a recipient whose full church scope extends beyond theirs. Additional permissions never change role, church membership or oversight appointments. Managers may grant only capabilities they hold; overall admins may issue any catalogued capability. A temporary capability cannot be passed on with a longer expiry.

Active grants are resolved from the database on every authenticated API request. Expired or revoked grants cease to authorize requests without waiting for sign-out or token expiry. Changing the recipient’s role/home church, or expanding their church scope beyond the original grant, pauses extra access pending review. Shrinking the accessible church scope does not expand any grant.

The management permission itself is not delegatable. Unknown capability names and unlisted endpoints remain blocked. Finance record/period rules and follow-up ownership rules remain enforced separately. An attendance-entry grant authorizes entry only at the user’s assigned local station, never at another oversight church.

## Supported capabilities

Members, guests, attendance, service groups, finance viewing/offerings/expenses/expense approval/period locks, reports, communication history/sending, and follow-up viewing/creation/editing. Create/edit capabilities include the stated read prerequisites. Broader user/role administration, children safeguarding, approval route administration and global finance setup remain role-controlled.

## Persistence and concurrency

PermissionDelegation stores issuance, recipient, capability, expiry, issuer, reason, captured church scope and revocation history. Records are revoked rather than deleted. A recipient permissionRevision is checked inside a MongoDB transaction alongside issuance/revocation, preventing concurrent screens from silently overwriting each other. The deployment database must support transactions: a MongoDB replica set or Atlas cluster.

API tests cover scope, self/higher-role protection, timed authority, revocation, expiry, concurrency conflicts, authentication refresh and explicit endpoint gates. Web tests cover navigation, translations and API/web catalog parity.

The optional `apps/api/test/permissions-mongo.e2e.cjs` test exercises the real aggregation and transactions against a disposable local MongoDB replica set, including concurrent writes and rollback. Build the API first and set `PERMISSION_TEST_MONGO` to a loopback URI whose database name starts with `chuflow_permissions_qa_`. The test refuses other hosts/databases and drops only that QA database when finished.
