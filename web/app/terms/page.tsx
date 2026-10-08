export const metadata = {
  title: "Terms — josho-hr",
};

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-8 py-12 text-sm leading-relaxed">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Terms of use</h1>
        <p className="text-neutral-500">
          Soft-launch terms — short and plain. The full counsel-reviewed
          version will replace this before public launch.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">What josho-hr is</h2>
        <p className="text-neutral-300">
          A multi-tenant tool that helps you tailor and submit job
          applications. You bring your own LLM API key (BYOK); we use it on
          your behalf for resume tailoring, cover letters, and skill-gap
          analysis. Trial accounts get a small shared LLM pool to start.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Your responsibilities</h2>
        <ul className="list-inside list-disc text-neutral-300">
          <li>Truthful information: don&apos;t submit fabricated education,
              credentials, or work history.</li>
          <li>Respect ATS rate limits: don&apos;t use josho-hr to spam
              employers or violate any platform&apos;s terms.</li>
          <li>You authorize each application by clicking Apply. We do not
              auto-submit without your action.</li>
          <li>Keep your account credentials safe.</li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Service availability</h2>
        <p className="text-neutral-300">
          Soft launch is best-effort. We may pause access, change limits, or
          rotate the trial LLM pool without notice while we stabilize. Your
          data export remains available throughout.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Limitation of liability</h2>
        <p className="text-neutral-300">
          josho-hr is provided &quot;as is&quot; during soft launch. We are not
          responsible for outcomes of any specific application — including
          rejections, ghosting, or downstream actions taken by employers based
          on submitted materials.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">Termination</h2>
        <p className="text-neutral-300">
          You can delete your account anytime in Settings. We can suspend
          accounts that violate these terms or attempt to circumvent rate
          limits.
        </p>
      </section>

      <p className="pt-4 text-xs text-neutral-500">
        Last updated: 2026-05-03. Questions:{" "}
        <a className="underline" href="mailto:hello@joshoit.com">hello@joshoit.com</a>.
      </p>
    </main>
  );
}
