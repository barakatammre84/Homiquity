# Playbook (a): Locked-out user

**Status: rehearsal asset.** No live borrowers yet — this is drilled ahead of need, not written from real tickets.

## Trigger

Borrower says any of: "I can't log in," "it says invalid password but I know it's right," "my account is locked," "I never got the verification email."

## First response (exact copy)

> Sorry for the trouble getting in — let's get you back into your account. Two things happen after repeated failed attempts: your password may just be wrong, or the account may be temporarily locked for security. Either way, the fix is the same:
>
> 1. Go to the sign-in page and click **"Forgot password?"**
> 2. Enter the email you signed up with. If an account exists for that email, we'll send a reset link right away — it's valid for **30 minutes**.
> 3. Click the link and set a new password. This also automatically clears any lockout on your account, so you'll be able to sign in immediately with your new password.
>
> If you don't see the email within a few minutes, check spam/junk, and make sure you're using the exact email you registered with.
>
> Separately, if you're waiting on an **email verification** link (from when you first signed up), that link is valid for **48 hours** — if it's expired, sign in and use "Resend verification email," or let us know and we'll help.

## What to check in the app

- Confirm which case it is before troubleshooting further: a locked account and a wrong password produce the *identical* generic message, **"Invalid email or password"** (`client/src/pages/public/Login.tsx:58`) — this is deliberate (Reg-style enumeration resistance; see `server/auth.ts:165-167`), so you cannot visually distinguish "locked" from "wrong password" in the UI. Don't guess out loud which one it is — the reset flow fixes both, so route to it regardless.
- The lockout policy: 5 straight failed attempts locks the account for 15 minutes; each further failure doubles the window, capped at 24 hours (`server/services/loginLockout.ts:12-14`). A successful login — including via password reset — resets the counter to zero.
- Reset request: `POST /api/auth/forgot-password` always returns the same generic success message whether or not the email exists (`server/auth.ts:226-249`) — this is intentional anti-enumeration behavior, not a bug, so don't be surprised if a borrower says "it told me it sent something" for an email that isn't actually registered.
- Reset token lifetime: 30 minutes (`RESET_TTL_MINUTES`, `server/services/accountRecovery.ts:9`). Verification token lifetime: 48 hours (`VERIFY_TTL_HOURS`, `server/services/accountRecovery.ts:10`). Both are single-use, SHA-256-hashed at rest, and issuing a new one invalidates any older outstanding token of the same type (`server/services/accountRecovery.ts:47,69`).
- Confirmed: completing a reset clears `failedLoginAttempts` and `lockoutUntil` in the same update as the password change (`server/integrations/auth/storage.ts:151-158`) — so "reset clears the lockout" is a verified code fact, not an assumption.
- Client pages: `/forgot-password`, `/reset-password`, `/verify-email` (routed in `client/src/App.tsx:183-185`); "Forgot password?" link lives on `client/src/pages/public/Login.tsx:105`.
- If the borrower says the reset email never arrives at all (not just spam): check whether `SENDGRID_API_KEY` is set in the environment they're testing against — without it, `emailService.ts` only logs to console and no real email goes out. This is a known local-dev limitation, not a borrower-facing bug, in an env where the key is configured.

## Escalation line

If reset + verification-resend both fail to restore access (e.g., borrower insists the email is correct and no reset arrives after 10+ minutes with the key configured), escalate to the founder to check server logs / SendGrid delivery status directly — do not attempt to manually flip account fields in the database as a support workaround.

## Compliance rail this must never cross

Never confirm or deny whether a specific email address has an account on Homiquity, even to the borrower who is asking about their own email, until they've completed the reset/login flow themselves. The generic "if an account exists…" copy exists specifically so support conversations can't be turned into an account-enumeration oracle — repeat the same generic language rather than confirming account existence directly.
