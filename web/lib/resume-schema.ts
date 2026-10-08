import { z } from "zod";

/**
 * Structured resume schema stored at profiles.structured_data (JSONB).
 * This is the contract between the onboarding parser and the Phase 3
 * resume_tailor wrapper in the worker. Any change here is a data-model
 * change and requires a migration note.
 */

export const experienceItem = z.object({
  company: z.string(),
  role: z.string(),
  location: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

export const projectItem = z.object({
  name: z.string(),
  stack: z.array(z.string()).default([]),
  link: z.string().optional(),
  description: z.string().optional(),
  bullets: z.array(z.string()).default([]),
});

export const educationItem = z.object({
  school: z.string(),
  degree: z.string().optional(),
  field: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  gpa: z.string().optional(),
  coursework: z.array(z.string()).default([]),
});

export const resumeSchema = z.object({
  identity: z.object({
    full_name: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    website: z.string().optional(),
    location: z.string().optional(),
  }),
  summary: z.string().optional().default(""),
  experience: z.array(experienceItem).default([]),
  projects: z.array(projectItem).default([]),
  education: z.array(educationItem).default([]),
  skills: z.record(z.string(), z.array(z.string())).default({}),
});

export type ResumeStructured = z.infer<typeof resumeSchema>;

export const EXTRACTION_PROMPT = `You are a resume parser. Extract the resume below as strict JSON matching exactly this TypeScript type:

type Resume = {
  identity: { full_name: string; email?: string; phone?: string; linkedin?: string; github?: string; website?: string; location?: string };
  summary?: string;
  experience: Array<{ company: string; role: string; location?: string; start?: string; end?: string; bullets: string[] }>;
  projects: Array<{ name: string; stack: string[]; link?: string; description?: string; bullets: string[] }>;
  education: Array<{ school: string; degree?: string; field?: string; start?: string; end?: string; gpa?: string; coursework: string[] }>;
  skills: Record<string, string[]>; // e.g., { "Languages": ["Python","TypeScript"], "Cloud": ["AWS","GCP"] }
};

Return ONLY the JSON object, no prose, no markdown fence. Preserve original wording for bullets.`;
