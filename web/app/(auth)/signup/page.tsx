import { MagicLinkForm } from "../MagicLinkForm";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-stretch justify-center gap-4 px-8">
      <h1 className="text-2xl font-semibold">Create account</h1>
      <p className="text-sm text-neutral-400">
        Trial accounts start with 100 free LLM calls and participate in the
        contribution model. See{" "}
        <a href="/terms" className="underline hover:text-neutral-300">
          Terms
        </a>{" "}
        and{" "}
        <a href="/privacy" className="underline hover:text-neutral-300">
          Privacy
        </a>
        .
      </p>
      <MagicLinkForm next={next ?? "/onboarding"} cta="Send magic link" signup />
      <p className="text-xs text-neutral-500">
        Already have an account?{" "}
        <a href="/login" className="underline hover:text-neutral-300">
          Sign in
        </a>
      </p>
    </main>
  );
}
