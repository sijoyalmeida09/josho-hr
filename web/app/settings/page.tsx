import { requireUser } from "@/lib/auth";
import { ProfileForm } from "./ProfileForm";
import { KeysForm } from "./KeysForm";
import { CompanionPanel } from "./CompanionPanel";
import { DangerZone } from "./DangerZone";

export default async function SettingsPage() {
  await requireUser("/settings");

  const sections: Array<{
    id: string;
    title: string;
    subtitle: string;
    body: React.ReactNode;
  }> = [
    {
      id: "profile",
      title: "Profile",
      subtitle: "Name, contact info, brand preference.",
      body: <ProfileForm />,
    },
    {
      id: "keys",
      title: "API keys (BYOK)",
      subtitle:
        "Paste your own LLM provider keys. Setting any key disables the trial pool and exempts you from the contribution model.",
      body: <KeysForm />,
    },
    {
      id: "integrations",
      title: "Integrations",
      subtitle:
        "Connect your own n8n webhook to pipe application events in and out. Ships in Phase 3.",
      body: (
        <p className="text-sm text-neutral-500">
          n8n integration UI is wired in Phase 3 once the worker dispatcher
          lands. See{" "}
          <a
            className="underline hover:text-neutral-300"
            href="https://github.com/n8n-io/n8n"
            target="_blank"
            rel="noreferrer"
          >
            n8n
          </a>{" "}
          for the tool.
        </p>
      ),
    },
    {
      id: "companion",
      title: "Local sync companion",
      subtitle:
        "A single-file Python script that mirrors your cloud data under ~/josho-hr.",
      body: <CompanionPanel />,
    },
    {
      id: "danger",
      title: "Export / Delete",
      subtitle: "Full account export and deletion per GDPR.",
      body: <DangerZone />,
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-8 py-12">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Settings</h1>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded border border-neutral-700 px-3 py-1.5 text-xs"
          >
            Sign out
          </button>
        </form>
      </header>

      <ul className="flex flex-col gap-4">
        {sections.map((s) => (
          <li
            key={s.id}
            id={s.id}
            className="flex flex-col gap-3 rounded-lg border border-neutral-800 bg-neutral-900 p-5"
          >
            <div>
              <h2 className="text-lg font-medium">{s.title}</h2>
              <p className="text-sm text-neutral-400">{s.subtitle}</p>
            </div>
            {s.body}
          </li>
        ))}
      </ul>
    </main>
  );
}
