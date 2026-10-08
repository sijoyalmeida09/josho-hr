import { MagicLinkForm } from "../MagicLinkForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-stretch justify-center gap-4 px-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="text-sm text-neutral-400">
        We&apos;ll send you a magic link. No password required.
      </p>
      <MagicLinkForm next={next} cta="Send magic link" />
      <p className="text-xs text-neutral-500">
        New here?{" "}
        <a href="/signup" className="underline hover:text-neutral-300">
          Create account
        </a>
      </p>
    </main>
  );
}
