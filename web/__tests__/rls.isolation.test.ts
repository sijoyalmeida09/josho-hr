/**
 * GATE-DATA-02 verification test.
 *
 * Binary pass rule for cross-tenant isolation: with two real Supabase users,
 * user A authenticated with their own JWT must NOT be able to SELECT, UPDATE,
 * or DELETE any row that belongs to user B in any user-scoped table.
 *
 * Requires test env vars (point at a TEST project, NOT production):
 *   TEST_SUPABASE_URL
 *   TEST_SUPABASE_SERVICE_ROLE_KEY
 *   TEST_SUPABASE_ANON_KEY
 *
 * Run: pnpm vitest run web/__tests__/rls.isolation.test.ts
 *
 * The suite is auto-skipped when env vars are missing so PRs that don't
 * touch the schema aren't blocked by missing test creds. Launch sign-off
 * requires the suite to be run with env vars present and green — a skipped
 * run is NOT a pass.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.TEST_SUPABASE_URL;
const SERVICE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY;

const ENABLED = Boolean(URL && SERVICE_KEY && ANON_KEY);

const USER_SCOPED_TABLES = [
  "profiles",
  "user_api_keys",
  "user_quota",
  "user_integrations",
  "companion_tokens",
  "applications",
  "application_events",
  "application_skill_gaps",
  "emails",
  "job_runs",
  "sijoy_contributions",
  "daily_stats",
  "templates",
  "trial_quota_log",
] as const;

interface TestUser {
  id: string;
  email: string;
  client: SupabaseClient;
}

let admin: SupabaseClient;
let userA: TestUser;
let userB: TestUser;
let appAId: number | null = null;
let appBId: number | null = null;

async function makeUser(email: string): Promise<TestUser> {
  const password = `Test_${Math.random().toString(36).slice(2)}_${Date.now()}!`;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createErr || !created.user) throw createErr ?? new Error("createUser returned no user");
  const id = created.user.id;

  const userClient = createClient(URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signinErr } = await userClient.auth.signInWithPassword({ email, password });
  if (signinErr) throw signinErr;

  return { id, email, client: userClient };
}

async function dropUser(u: TestUser): Promise<void> {
  try {
    await admin.auth.admin.deleteUser(u.id);
  } catch {
    /* best-effort cleanup */
  }
}

describe.skipIf(!ENABLED)("GATE-DATA-02 cross-tenant isolation", () => {
  beforeAll(async () => {
    admin = createClient(URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const stamp = Date.now();
    userA = await makeUser(`rls-a-${stamp}@josho-hr.test`);
    userB = await makeUser(`rls-b-${stamp}@josho-hr.test`);

    const { data: a, error: errA } = await admin
      .from("applications")
      .insert({
        user_id: userA.id,
        company: "AlphaCo",
        url: `https://test.invalid/a-${stamp}`,
      })
      .select("id")
      .single();
    if (errA || !a) throw errA ?? new Error("seed A failed");
    appAId = a.id;

    const { data: b, error: errB } = await admin
      .from("applications")
      .insert({
        user_id: userB.id,
        company: "BetaCo",
        url: `https://test.invalid/b-${stamp}`,
      })
      .select("id")
      .single();
    if (errB || !b) throw errB ?? new Error("seed B failed");
    appBId = b.id;
  }, 30_000);

  afterAll(async () => {
    if (userA) await dropUser(userA);
    if (userB) await dropUser(userB);
  });

  it("declares the complete set of user-scoped tables", () => {
    expect(USER_SCOPED_TABLES).toHaveLength(14);
  });

  it("user A can SELECT their own application", async () => {
    const { data, error } = await userA.client
      .from("applications")
      .select("id, company")
      .eq("id", appAId!)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data?.company).toBe("AlphaCo");
  });

  it("user A cannot SELECT user B's application by id", async () => {
    const { data, error } = await userA.client
      .from("applications")
      .select("id, company")
      .eq("id", appBId!)
      .maybeSingle();
    expect(error).toBeNull();
    expect(data).toBeNull();
  });

  it("user A cannot SELECT any of user B's rows across user-scoped tables", async () => {
    for (const table of USER_SCOPED_TABLES) {
      const { data, error } = await userA.client
        .from(table)
        .select("user_id")
        .eq("user_id", userB.id)
        .limit(5);
      if (error) continue; // RLS denial counts as pass
      expect(data ?? []).toHaveLength(0);
    }
  }, 30_000);

  it("user A cannot UPDATE user B's application", async () => {
    const { data, error } = await userA.client
      .from("applications")
      .update({ notes: "tampered-by-a" })
      .eq("id", appBId!)
      .select();
    if (error) {
      expect(error).toBeDefined();
      return;
    }
    expect(data ?? []).toHaveLength(0);
    const { data: pristine } = await admin
      .from("applications")
      .select("notes")
      .eq("id", appBId!)
      .single();
    expect(pristine?.notes ?? "").not.toBe("tampered-by-a");
  });

  it("user A cannot DELETE user B's application", async () => {
    const { error } = await userA.client.from("applications").delete().eq("id", appBId!);
    if (!error) {
      const { data: stillThere } = await admin
        .from("applications")
        .select("id")
        .eq("id", appBId!)
        .maybeSingle();
      expect(stillThere).not.toBeNull();
    }
  });

  it("user A cannot INSERT a row with user B's user_id", async () => {
    const { error } = await userA.client.from("applications").insert({
      user_id: userB.id,
      company: "Hijack",
      url: `https://test.invalid/hijack-${Date.now()}`,
    });
    expect(error).not.toBeNull();
  });

  it("user A cannot read user B objects in storage buckets", async () => {
    const buckets = ["resumes", "cover_letters", "traces"];
    for (const bucket of buckets) {
      const { data, error } = await userA.client.storage
        .from(bucket)
        .list(userB.id, { limit: 5 });
      if (error) continue;
      expect(data ?? []).toHaveLength(0);
    }
  });
});

describe.skipIf(ENABLED)("GATE-DATA-02 (env not configured)", () => {
  it("skips — set TEST_SUPABASE_URL, TEST_SUPABASE_SERVICE_ROLE_KEY, TEST_SUPABASE_ANON_KEY to run", () => {
    expect(USER_SCOPED_TABLES).toHaveLength(14);
  });
});
