import PageHeader from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";

const LAST_REVIEWED = "2026-06-19";

const SECTIONS: { heading: string; items: string[] }[] = [
  {
    heading: "Data handled (and not handled)",
    items: [
      "Stored: staff names, login/work emails, job titles, employment types, schedules, time-off and callout records, ratio configuration, Compliance Records, audit logs.",
      "Sales lead records (prospect pharmacy and contact details from website demo requests) are stored for internal follow-up and visible only to platform administrators — never to pharmacy tenants.",
      "An email log records every message the app sends (recipient, subject, and the rendered body) for delivery auditing; it is visible only to platform administrators. In-app feedback/bug reports may include a user-attached screenshot, stored in a private bucket reachable only by platform administrators.",
      "Not stored by design: PHI or any patient data, prescription data, compensation or payroll data, credential documents (license numbers, certificates).",
      "Expected prescription-volume figures (whole numbers, per location per day) may be recorded for planning and shown on the schedule — they are never enforced and contain no patient information.",
    ],
  },
  {
    heading: "Tenant isolation",
    items: [
      "Postgres row-level security on every tenant table; every row carries tenant_id.",
      "Policies derive the caller's tenant from their authenticated session via security-definer functions — application code cannot opt out.",
      "The service-role key (which bypasses RLS) is used only for onboarding (before a user has a tenant) and scheduled jobs; it exists only as a server-side environment variable.",
    ],
  },
  {
    heading: "Authentication & access",
    items: [
      "Magic-link email sign-in (Supabase Auth) — no passwords stored, phished, or reused. Auth endpoints are rate-limited.",
      "An account may have additional admin-registered sign-in addresses (e.g., a work email for the work desktop); every sign-in still proves control of the inbox via a one-time link.",
      "Roles: Owner/Admin, Scheduler (department-scopable), Approver/Supervisor, Read-only, Staff. Server actions re-check the role on every write. Schedulers and supervisors can edit pharmacy configuration (locations, ratio rules, work types); going live, deleting the workspace, assigning roles, and offboarding remain Owner/Admin-only.",
      "Staff see their own schedule and requests; managers see their tenant; nobody sees another tenant.",
    ],
  },
  {
    heading: "Encryption & secrets",
    items: [
      "TLS for all traffic; encryption at rest via Supabase/AWS.",
      "All secrets (database service role, Resend, OpenAI) are server-side environment variables. No AI or email call ever originates from the browser.",
    ],
  },
  {
    heading: "AI boundaries",
    items: [
      "AI (OpenAI, server-side) drafts, explains, and proposes. The deterministic ratio/constraints engine is the only source of compliance truth.",
      "Every compliance-affecting AI proposal is validated by the engine and requires explicit human confirmation before it commits.",
      "The help assistant answers only from RxShift's own help articles and does not give regulatory advice. Its source articles are read with the caller's own permissions, so platform-admin documentation is never exposed to a pharmacy user or fed to their assistant.",
    ],
  },
  {
    heading: "Outbound email safety",
    items: [
      "Every email RxShift sends — notifications, sign-in links, the website demo form, feedback, and system alerts — flows through one send path (sendEmail), which applies a send-time gate: a per-tenant kill switch plus an optional recipient allowlist. When an allowlist is set, only those addresses can receive email; all others are dropped and the suppression is recorded.",
      "Each send (including suppressed and redirected ones, and the gate decision) is written to an append-only email log. Delivery failures — and bounces/complaints reported by the email provider's signed webhook — are detected and filed automatically as system issues for the team to review.",
      "Tenants have a lifecycle (setup → trial → live). Trial tenants are fully functional but send no email to staff; going live is an explicit owner action with a confirmation warning, recorded in the audit log.",
      "Demo and test tenants are seeded with no staff email addresses, the kill switch off, and trial status — four independent locks against accidental email to real people.",
      "Demo-mode tenants hold entirely fictional rosters; every email they would send is either rewritten to one configured demo inbox or suppressed outright, and demo tenants can never be switched live.",
      "Live out-of-ratio alerts to managers pass through the same send-time gate as every other notification — trial and demo tenants never email real staff. RxShift never contacts a board of pharmacy; whether to report is always the pharmacy's decision.",
    ],
  },
  {
    heading: "Audit & retention",
    items: [
      "Append-only activity log for schedule changes, approvals, imports, role changes, offboarding, and AI-applied operations — viewable by managers at Audit Log.",
      "Audit entries are never edited or deleted; an authorized manager can append a note for context (e.g. a missed clock-back), attributed and timestamped, leaving the original entry intact.",
      "Offboarding blocks a departed employee's sign-in while preserving their name in historical schedules, logs, and Compliance Records.",
      "Override log: every time a manager proceeds past a compliance warning — publishing a flagged schedule, or approving a time-off/swap that creates a ratio deficiency — records who, when, the warning type, and the required reason.",
      "Compliance Record (as-worked): an immutable, hour-by-hour record of actual ratio compliance per location, finalized after each hour from the published schedule adjusted by live statuses and retained two years. Rows are never edited; a manager appends an attributed note to explain an hour. Exports as a non-editable PDF; CSV available for data. (The Coverage Forecast is the separate, schedule-derived planning projection.)",
    ],
  },
  {
    heading: "Known limitations (current build)",
    items: [
      "Single-region hosting (US); no SOC 2 attestation yet — planned as the customer base grows.",
      "Email notifications depend on Resend deliverability; in-app state is authoritative.",
      "No SMS/push notifications yet (email + in-app only).",
    ],
  },
  {
    heading: "Incident response",
    items: [
      "Suspected incidents: email info@rxshift.io. Affected customers are notified promptly with scope, impact, and remediation steps.",
    ],
  },
];

export default function SecurityPosturePage() {
  return (
    <>
      <PageHeader title="Security Posture" />
      <div className="flex-1 p-8">
        <div className="max-w-[760px] space-y-5">
          <p className="font-body text-sm text-steel">
            The full statement of how RxShift handles your data — the detail
            behind the public security page. Last reviewed {LAST_REVIEWED}.
          </p>
          {SECTIONS.map((s) => (
            <Card key={s.heading}>
              <h2 className="mb-3 font-brand text-base font-bold text-navy">
                {s.heading}
              </h2>
              <ul className="space-y-2">
                {s.items.map((item, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 font-body text-sm leading-relaxed text-steel"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
