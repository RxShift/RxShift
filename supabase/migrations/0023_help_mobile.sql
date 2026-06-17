-- 0023: Help content — using RxShift on a phone (sign in + add to home screen).
-- Tenant-facing (admin_only = false), Basics category.

insert into help_article (slug, title, category, sort_order, body_markdown, published, admin_only) values

('using-on-your-phone', 'Using RxShift on your phone', 'Basics', 20,
'## RxShift works on your phone

Sign in on your phone to check your schedule, set your status (Working / Lunch / …), and send requests — no computer needed. The schedule builder and settings are still best on a computer.

## Sign in

1. In your phone''s browser, go to **app.rxshift.io**.
2. Enter your work email — we send a one-tap sign-in link (no password).
3. Open the link on the same phone. You''re in.

## Add it to your home screen (so it opens like an app)

**iPhone (Safari):** tap the **Share** button (the square with an up arrow) → **Add to Home Screen** → **Add**. An RxShift icon appears on your home screen.

**Android (Chrome):** tap the **⋮** menu (top right) → **Add to Home screen** (or **Install app**) → **Add**.

Now tap the RxShift icon any time — it opens full-screen, with no browser bar.

## What you can do from your phone

- **My Schedule** — your upcoming shifts and your team this week.
- **My status now** — one tap sets Working, Lunch, Meeting, and more; it updates the live ratio board instantly. If you''re a pharmacist, it also tells you whether stepping away keeps your pharmacy in ratio.
- **Requests** — ask for time off, log a callout, or propose a shift swap.', true, false);
