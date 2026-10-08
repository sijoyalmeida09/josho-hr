"use client";

import { useActionState } from "react";
import { sendMagicLink, type AuthFormState } from "./actions";

const initial: AuthFormState = {};

interface MagicLinkFormProps {
  next?: string;
  cta: string;
  /** When true, renders an invite-code field and marks the request as signup. */
  signup?: boolean;
}

export function MagicLinkForm({ next, cta, signup = false }: MagicLinkFormProps) {
  const [state, formAction, isPending] = useActionState(sendMagicLink, initial);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {signup ? <input type="hidden" name="is_signup" value="1" /> : null}
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-neutral-400">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
        />
      </label>
      {signup ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-neutral-400">Invite code</span>
          <input
            type="text"
            name="invite_code"
            autoComplete="off"
            placeholder="from-sijoy"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm focus:border-neutral-400 focus:outline-none"
          />
          <span className="text-xs text-neutral-500">
            Soft-launch — DM Sijoy for a code.
          </span>
        </label>
      ) : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
      >
        {isPending ? "Sending…" : cta}
      </button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-emerald-400">
          {state.notice}
        </p>
      ) : null}
    </form>
  );
}
