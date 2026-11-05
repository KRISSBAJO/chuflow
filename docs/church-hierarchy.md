# Local churches and oversight appointments

Every branch remains one local church. District, zone and area units are administrative boundaries, not additional church records. Each unit appoints an existing local church as headquarters and that church's active resident pastor as its oversight pastor. The same resident-pastor account can hold district, zonal and/or area appointments at its own church.

## Set up in Structure

1. Use **National & district setup** to configure the existing national region and district catalog. Existing districts remain authoritative and keep their IDs.
2. In **Structure**, choose a district and add its district headquarters level. Add zones beneath it and areas beneath each zone.
3. Place existing local churches into their areas. Zone-only placement is available during transition. Churches without a zone or area remain under their existing district and keep all records.
4. Choose a headquarters church within each unit, then appoint its resident pastor. If the pastor is missing, use Users to configure the existing account's local church and resident-pastor role first. Do not create a second account for oversight.

Only super administrators, national administrators within their region, and district administrators within their district can change placement or appointments. Pastors can see structure and scoped statistics but cannot appoint themselves. Existing national/district role accounts continue to work; they are not automatically converted or reassigned. Their migration to a resident-pastor account with headquarters and oversight appointments is an explicit administrative decision.

## Access and daily work

AccessScopeService combines the pastor's home church with active, validated oversight boundaries. Area appointments include that area's churches; zones include their areas and any directly placed churches; districts include all their churches, including those awaiting placement. MongoDB returns each church ID once even if appointments overlap. Aggregates use existing church records, not a second headquarters ledger or roster.

Assignments are checked from the database on each scope resolution. The pastor must still be a resident pastor at the headquarters church, the headquarters must remain active and within its unit, and all ancestors and the district must be active. Reassignment, removal or deactivation revokes additional scope without issuing new passwords or waiting for an old token to expire. Local access remains governed by the existing account and branch.

The dashboard offers **My church** and an oversight overview. Branch filters recognize appointed resident pastors; all data requests remain checked by the API. Creating records defaults to the home church unless an authorized destination church is explicitly selected. Existing action-specific permissions still apply: an oversight appointment does not turn a pastor into a system administrator.

Structure shows district/zone/area church, member-record and guest-record counts. Restricted accounts see only accessible records and a partial-scope label. Excel/CSV exports use the same scoped overview. Other existing reports and operational pages continue to use branch IDs through the shared access scope. Headquarters church records are not added a second time when totals are computed.

## Changes and safeguards

Placement and appointment edits use revision checks to prevent silent overwrites. Parent types are fixed (district → zone → area); clients cannot inject a new parent into an appointment edit. Moving a headquarters out of its appointed area/zone is blocked until the appointment is cleared. A placed church cannot change district through the old branch editor until its placement is removed. District catalog renames retain stable district references and existing catalog rename propagation.

Unit deletion and automatic bulk migration are intentionally absent. Deactivation is reversible and child units must be deactivated first. Existing branch documents can lack the new optional placement fields; no destructive migration is required. Creation/edit events are recorded in the hierarchy change collection. API and browser deployments must both finish before using the new workspace.

Regression coverage includes ancestor revocation, cross-district boundaries, pastor transfers, headquarters validation, overlapping appointments, unique church rollups, stale edits, input validation, original role landing pages and operational lookup permissions. Live database and signed-in browser checks are separate from these automated checks.
