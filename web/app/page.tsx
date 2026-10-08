export default function Landing() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-8 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">josho-hr</h1>
      <p className="text-neutral-400">
        A job application workspace. Upload your resume, bring your own API keys,
        and let the pipeline tailor and submit applications. Every form field,
        cover letter, and skill gap is logged to your dashboard.
      </p>
      <div className="flex gap-3">
        <a
          href="/signup"
          className="rounded-md bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900"
        >
          Create account
        </a>
        <a
          href="/login"
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium"
        >
          Sign in
        </a>
      </div>
      <p className="text-xs text-neutral-500">
        Phase 1 skeleton. The full application workspace is built in Phases 2 through 4.
      </p>
    </main>
  );
}
