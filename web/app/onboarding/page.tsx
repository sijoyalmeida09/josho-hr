import { requireUser } from "@/lib/auth";
import { getServerSupabase } from "@/lib/supabase/server";
import { OnboardingWizard } from "./OnboardingWizard";

export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const supabase = await getServerSupabase();
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-8 py-12">
      <header>
        <h1 className="text-3xl font-semibold">Let&apos;s build your profile</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Five short steps. You can come back and edit anything later in Settings.
        </p>
      </header>
      <OnboardingWizard
        initialProfile={profile ?? null}
        userEmail={user.email ?? ""}
      />
    </main>
  );
}
