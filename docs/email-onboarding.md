# Account welcome emails and Relykit

Production uses the Relykit HTTPS API with `MAIL_PROVIDER=relykit`, a server-only
`RELYKIT_API_KEY`, and `MAIL_FROM=ChuFlow <no-reply@chuflow.com>`. SMTP remains
available for local development. No new dependency is required. Requests have a
15-second timeout, reject redirects and never expose provider error bodies.

The sending domain is verified with three DKIM CNAMEs plus the `send.chuflow.com`
MAIL FROM MX/SPF records. A monitoring-only DMARC record is installed. Website,
API, certificate and nameserver records are unchanged. DMARC aggregate reports
are not sent to an invented mailbox.

## Account creation

Creating an active user sends a branded welcome email containing their role,
workspace and a private 24-hour password-setup link. No plaintext password is
emailed. Only the token hash is stored. Inactive accounts are not invited.
Account creation remains successful when email delivery fails.

Administrators can resend from **Users → user → Security → Send welcome email**.
The API is `POST /api/users/:id/welcome`. It checks both the target's scope and
the manager's ability to assign that role. A conditional database update applies
a one-minute resend cooldown, including concurrent requests. Each attempt is
audited without the credential. The account stores attempt time, provider
message ID and acceptance/failure status.

A new setup link replaces any previous password-reset link. Password changes,
email updates and account deactivation invalidate pending reset links. Token
redemption matches the hash, expiry and active account in one database update
and removes the token, preventing replay. The public forgot-password endpoint
always returns the same generic response and never returns credentials, even
when mail is unavailable.

## Acceptance versus delivery

`accepted` means the provider accepted the request, not that it reached an inbox.
Use Relykit's Emails timeline to confirm delivery, bounces or failure. The legacy
internal `MailService.delivered` flag continues to mean provider acceptance for
existing communications/meeting/care callers; Relykit results additionally carry
`accepted` and `deliveryStatus` (normally `queued`). The new welcome UI says
“accepted for delivery”.

Retries of the same welcome/reset message use a stable idempotency key derived
from its private link. Unrelated messages have separate request keys, even if
their content is identical. No automatic welcome is sent to existing users on
deploy; an administrator must choose to send it.

## Validation

Mail transport tests cover endpoint/authentication, timeouts, redirect rejection,
idempotency, safe errors and HTML escaping. Welcome tests cover permissions,
disabled accounts, cooldown, provider failure, hashed tokens, expiry and audit
redaction. Password reset tests cover non-disclosing responses and atomic
single-use redemption. Existing API/web suites remain required.
