# EduHub Backend Auth Notes

## Email Delivery Modes

The auth service supports 3 email modes via environment variables:

- `EMAIL_PROVIDER=dev` (default): writes OTP/reset emails to `backend/tmp/dev-mailbox.log`
- `EMAIL_PROVIDER=sendgrid`: sends real emails using SendGrid API
- `EMAIL_PROVIDER=resend`: sends real emails using Resend API

Common vars:

- `EMAIL_FROM=no-reply@yourdomain.com`
- `FRONTEND_BASE_URL=http://localhost:8080` (used in reset links)

Provider-specific vars:

- SendGrid: `SENDGRID_API_KEY=...`
- Resend: `RESEND_API_KEY=...`

Optional debug vars:

- `EXPOSE_AUTH_DEBUG=true|false` (defaults to `true` outside production)

API note:

- `POST /api/auth/forgot-password` can include `frontendBaseUrl` (for example `window.location.origin`) so reset links match the current frontend host in local/dev environments.

## Security Controls Added

- Login request throttling per IP
- Account lockout after repeated invalid password attempts
- OTP verification throttling and temporary account OTP lockout
- OTP resend throttling
- Password reset request throttling
- Password reset submission throttling and lockout after repeated invalid token attempts

These controls are currently in-memory for local/project scope. In a multi-instance deployment, move them to Redis or another shared store.
