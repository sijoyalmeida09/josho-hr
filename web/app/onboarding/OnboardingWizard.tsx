"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ResumeStructured } from "@/lib/resume-schema";
import { StepUpload } from "./StepUpload";
import { StepReview } from "./StepReview";
import { StepBrand } from "./StepBrand";
import { StepKeys } from "./StepKeys";
import { StepFinish } from "./StepFinish";

type Profile = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  master_resume_path: string | null;
  structured_data: ResumeStructured | null;
  brand_preference: "hardware" | "software" | "auto" | "custom" | null;
  onboarding_complete: boolean | null;
};

const STEPS = ["Upload", "Review", "Brand", "Keys", "Finish"] as const;
type StepName = (typeof STEPS)[number];

export function OnboardingWizard({
  initialProfile,
  userEmail,
}: {
  initialProfile: Profile | null;
  userEmail: string;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile>(
    initialProfile ?? {
      user_id: "",
      email: userEmail,
      full_name: null,
      master_resume_path: null,
      structured_data: null,
      brand_preference: null,
      onboarding_complete: false,
    }
  );
  const [step, setStep] = useState<StepName>(() => {
    if (!initialProfile?.master_resume_path) return "Upload";
    if (!initialProfile?.structured_data) return "Review";
    if (!initialProfile?.brand_preference) return "Brand";
    return "Keys";
  });

  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);

  function next() {
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) setStep(STEPS[i + 1]);
  }
  function back() {
    const i = STEPS.indexOf(step);
    if (i > 0) setStep(STEPS[i - 1]);
  }

  async function finish() {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_complete: true }),
    });
    if (res.ok) router.push("/app");
  }

  return (
    <section className="flex flex-col gap-6">
      <Stepper stepIndex={stepIndex} />

      {step === "Upload" && (
        <StepUpload
          hasResume={Boolean(profile.master_resume_path)}
          onUploaded={(path) => {
            setProfile((p) => ({ ...p, master_resume_path: path }));
            next();
          }}
        />
      )}

      {step === "Review" && (
        <StepReview
          structured={profile.structured_data}
          onParsed={(data) => {
            setProfile((p) => ({
              ...p,
              structured_data: data,
              full_name: data.identity.full_name,
            }));
          }}
          onSaved={(data) => {
            setProfile((p) => ({ ...p, structured_data: data }));
            next();
          }}
          onBack={back}
        />
      )}

      {step === "Brand" && (
        <StepBrand
          current={profile.brand_preference ?? "auto"}
          onSaved={(brand) => {
            setProfile((p) => ({ ...p, brand_preference: brand }));
            next();
          }}
          onBack={back}
        />
      )}

      {step === "Keys" && <StepKeys onSaved={next} onBack={back} />}

      {step === "Finish" && (
        <StepFinish profile={profile} onFinish={finish} onBack={back} />
      )}
    </section>
  );
}

function Stepper({ stepIndex }: { stepIndex: number }) {
  return (
    <ol className="flex items-center gap-2 text-xs text-neutral-400">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2">
          <span
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${
              i <= stepIndex
                ? "border-neutral-100 bg-neutral-100 text-neutral-900"
                : "border-neutral-700"
            }`}
          >
            {i + 1}
          </span>
          <span className={i === stepIndex ? "text-neutral-100" : ""}>{s}</span>
          {i < STEPS.length - 1 && <span className="text-neutral-700">—</span>}
        </li>
      ))}
    </ol>
  );
}
