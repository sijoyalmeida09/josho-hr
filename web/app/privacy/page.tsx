export const metadata = {
  title: "Privacy — josho-hr",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-8 py-12 text-sm leading-relaxed">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Privacy notice</h1>
        <p className="text-neutral-500">
          Plain-English summary of how josho-hr handles your data. The
          authoritative legal text will be reviewed by counsel before public
          launch — until then this is the soft-launch summary.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">What we store</h2>
        <ul className="list-inside list-disc text-neutral-300">
          <li>Your email address (Supabase Auth).</li>
          <li>Your profile fields: name, contact links, work-authorization
              status, target roles.</li>
          <li>Resumes you upload, structured once parsed.</li>
          <li>Job-application metadata + Playwright submission traces (kept
              for at most 90 days, auto-purged).</li>
          <li>Generated cover letters and skill-gap analyses.</li>
          <li>Your encrypted API keys (Anthropic, n8n, Gmail app password) —
              AES-256-GCM at rest. We never see the plaintext after upload.</li>
          <li>For Gmail ingestion: only subject, sender, snippet, and our
              classification. Full bodies are never persisted.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">What we don&apos;t do</h2>
        <ul className="list-inside list-disc text-neutral-300">
          <li>We don&apos;t sell or share your data with third parties.</li>
          <li>We don&apos;t train models on your resume or cover letters.</li>
          <li>We don&apos;t apply on your behalf without your explicit click.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Retention</h2>
        <ul className="list-inside list-disc text-neutral-300">
          <li>Submission traces: ≤ 90 days.</li>
          <li>Email metadata: ≤ 365 days.</li>
          <li>Account deletion: hard purge within 24 hours of request.</li>
          <li>Application events &amp; skill gaps: as long as the parent
              application exists.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Your controls</h2>
        <ul className="list-inside list-disc text-neutral-300">
          <li><strong>Export:</strong> <code>GET /api/account/export</code>
              returns a JSON archive of everything we hold for your account.</li>
          <li><strong>Delete:</strong> Settings → Delete account. Hard purge
              within 24 hours.</li>
          <li><strong>Rotate keys:</strong> Settings → API keys.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Soft-launch caveat</h2>
        <p className="text-neutral-300">
          josho-hr is in invite-only soft launch. Treat data exposure risk as
          higher than for a fully audited service. If something feels wrong,
          email <a className="underline" href="mailto:hello@joshoit.com">hello@joshoit.com</a>{" "}
          and we&apos;ll fix or delete.
        </p>
      </section>

      <p className="pt-4 text-xs text-neutral-500">
        Last updated: 2026-05-03. The full canonical doc lives at{" "}
        <code>josho-hr/docs/privacy.md</code> in the repo.
      </p>
    </main>
  );
}
