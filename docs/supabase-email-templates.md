# Supabase Auth email templates (paste-in)

Every KNOWN user's sign-in email is now sent by RxShift itself (branded,
via Resend, through `/api/auth/login-link`). Supabase's own templates are
only used for **brand-new signups** (an email the app has never seen →
the login form falls back to `signInWithOtp`).

To brand that remaining path, paste the HTML below in the Supabase
dashboard: **Authentication → Emails → Templates → Magic Link** (and the
same body works for **Confirm signup** with the heading swapped).

Template variables: Supabase substitutes `{{ .ConfirmationURL }}`.

```html
<div style="font-family: -apple-system, 'Helvetica Neue', sans-serif; max-width: 520px; margin: 0 auto; background: #ffffff;">
  <div style="padding: 18px 0; border-bottom: 2px solid #F07C30;">
    <span style="color: #1C2F5E; font-size: 19px; font-weight: 700; letter-spacing: -0.3px;">Rx<span style="color:#F07C30; font-weight: 700;"> · </span><span style="font-weight: 500;">Shift</span></span>
  </div>
  <div style="padding: 22px 0; color: #4A5B7A; font-size: 15px; line-height: 1.65;">
    <p style="margin: 0 0 12px;">Welcome to RxShift. Click the button below to sign in and start setting up your pharmacy. The link expires in an hour and can be used once.</p>
    <p style="margin: 20px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: #F07C30; color: #ffffff; font-family: -apple-system, 'Helvetica Neue', sans-serif; font-size: 14px; font-weight: bold; padding: 12px 26px; border-radius: 6px; text-decoration: none;">Sign in to RxShift</a>
    </p>
    <p style="margin: 0 0 12px;">If you didn't request this, you can safely ignore this email.</p>
  </div>
  <p style="color: #9BAABB; font-size: 12px; border-top: 1px solid #DDE5EF; padding-top: 14px; margin: 0;">
    Sent by RxShift — compliance-ready pharmacy scheduling · rxshift.io
  </p>
</div>
```

Suggested subject line: `Your RxShift sign-in link`

After pasting, send yourself a signup from a never-used address to
confirm rendering (then delete the orphan auth user with
`npx tsx scripts/provision-user.ts --delete-auth-user <email>`).
