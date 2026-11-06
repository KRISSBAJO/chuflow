# Directory and detail workspaces

Member records open on Overview, with separate Profile & family, Spiritual growth, Service groups, and Care & communications sections. Editing a section sends only that section's fields. Optional values explicitly cleared by the operator are removed; omitted fields and group assignments are preserved. Linked children are visible only to staff with children's ministry management access.

The Members directory separates its roster, guest conversion, and registration links. Roster search remains visible, advanced filters start closed, and optional spiritual columns are available through Columns. Guest conversion searches the API for up to 15 matching guests instead of rendering a long select list.

Staff accounts open at `/users/[id]`. Profile, roles/access, security, and recorded account activity are separate. Oversight churches are calculated from current appointments and intersected with the viewing administrator's scope. Name/email matches to member records are labeled as matches rather than assumed account links.

Attendance separates service summaries, attendance-only approvals, insights, and service configuration. Recording and opening a service summary use dedicated pages. Legacy individual-record cleanup is available separately to staff who can manage service schedules. Routine attendance viewing does not load the full membership list.

Weekly reports open to the current reporting week, with visible date controls. Submissions use a compact paginated list and open full report details and review actions on their own page. Church comparison drills through national, district, zone, area, and church levels, including churches whose intermediate level has not been assigned. A missing matching submission displays a dash rather than zero attendance. Exports receive the displayed date range.

Care history is a paginated table with server-side text, activity-type and date filtering. Add activity opens a dedicated form and returns to the table after saving. Conversations record method and outcome; notes and conversations can record a next action and create the corresponding task. Existing visibility, ownership, opt-out, revision and branch checks remain enforced. Recording an activity does not send a message.

Directory detail links retain their filters, page and row anchor in a validated local return link. Tabs retain query filters and support narrow screens by scrolling horizontally. Translation catalogs for these workspaces include English, French, Spanish and Portuguese; other translation work can proceed independently.

Validation includes production builds, role/endpoint checks, focused field-preservation and access-scope tests, and browser checks against synthetic data. Browser preview screenshots are examples, not proof of production deployment.
