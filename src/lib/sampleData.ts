import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

/*
 * Optional "Load sample data" for empty workspaces. Inserts a small, neutral, fictional dataset
 * into the CURRENT workspace with ordinary inserts (RLS applies; organization_id is defaulted by
 * the database). Never touches profiles, settings or anything that already exists.
 */

export interface SampleDataResult {
  companies: number;
  contacts: number;
  deals: number;
  activities: number;
  tasks: number;
}

interface StageRow {
  id: string;
  name: string;
  position: number;
  is_won?: boolean | null;
  is_lost?: boolean | null;
}

const COMPANIES = [
  { key: "northwind", name: "Northwind Logistics", industry: "Logistics", website: "https://northwind.example.com" },
  { key: "brightpath", name: "Brightpath Health", industry: "Healthcare", website: "https://brightpath.example.com" },
  { key: "lumen", name: "Lumen Analytics", industry: "Software", website: "https://lumen.example.com" },
  { key: "harbor", name: "Harbor & Pine Hospitality", industry: "Hospitality", website: "https://harborpine.example.com" },
  { key: "cedar", name: "Cedar Ridge Manufacturing", industry: "Manufacturing", website: "https://cedarridge.example.com" },
  { key: "atlas", name: "Atlas Learning", industry: "Education", website: "https://atlaslearning.example.com" },
  { key: "greenleaf", name: "Greenleaf Foods", industry: "Food & Beverage", website: "https://greenleaf.example.com" },
  { key: "summit", name: "Summit Financial Partners", industry: "Financial Services", website: "https://summitfp.example.com" },
] as const;

type CompanyKey = (typeof COMPANIES)[number]["key"];

const CONTACTS: { key: string; company: CompanyKey; first: string; last: string; position: string; tags: string[] }[] = [
  { key: "maya", company: "northwind", first: "Maya", last: "Okafor", position: "VP Operations", tags: ["decision-maker"] },
  { key: "daniel", company: "northwind", first: "Daniel", last: "Brooks", position: "Fleet Manager", tags: [] },
  { key: "priya", company: "brightpath", first: "Priya", last: "Raman", position: "Chief Nursing Officer", tags: ["decision-maker"] },
  { key: "tom", company: "brightpath", first: "Tom", last: "Keller", position: "IT Director", tags: ["technical"] },
  { key: "sofia", company: "lumen", first: "Sofia", last: "Marquez", position: "Head of Data", tags: ["champion"] },
  { key: "ethan", company: "lumen", first: "Ethan", last: "Walsh", position: "CFO", tags: ["decision-maker"] },
  { key: "grace", company: "harbor", first: "Grace", last: "Lindqvist", position: "General Manager", tags: [] },
  { key: "omar", company: "harbor", first: "Omar", last: "Haddad", position: "Procurement Lead", tags: [] },
  { key: "hannah", company: "cedar", first: "Hannah", last: "Novak", position: "Plant Director", tags: ["decision-maker"] },
  { key: "luis", company: "cedar", first: "Luis", last: "Ferreira", position: "Quality Manager", tags: [] },
  { key: "aisha", company: "atlas", first: "Aisha", last: "Bello", position: "Director of Programs", tags: ["champion"] },
  { key: "ben", company: "atlas", first: "Ben", last: "Carter", position: "Operations Analyst", tags: [] },
  { key: "chloe", company: "greenleaf", first: "Chloe", last: "Dubois", position: "Supply Chain Lead", tags: [] },
  { key: "ryan", company: "summit", first: "Ryan", last: "Choi", position: "Managing Partner", tags: ["decision-maker"] },
  { key: "nora", company: "summit", first: "Nora", last: "Svensson", position: "Operations Manager", tags: [] },
];

/**
 * `stage`: index into the pipeline's OPEN stages (clamped), or "won"/"lost".
 * Days are relative to today: createdDaysAgo, closeInDays (negative = past), closedDaysAgo.
 */
const DEALS: {
  title: string;
  company: CompanyKey;
  contact: string;
  value: number;
  stage: number | "won" | "lost";
  probability: number;
  createdDaysAgo: number;
  closeInDays: number | null;
  closedDaysAgo?: number;
  lostReason?: string;
}[] = [
  { title: "Route optimization rollout", company: "northwind", contact: "maya", value: 48000, stage: 3, probability: 75, createdDaysAgo: 52, closeInDays: 12 },
  { title: "Driver app pilot", company: "northwind", contact: "daniel", value: 12500, stage: 0, probability: 15, createdDaysAgo: 6, closeInDays: 45 },
  { title: "Patient intake platform", company: "brightpath", contact: "priya", value: 86000, stage: 2, probability: 50, createdDaysAgo: 38, closeInDays: 28 },
  { title: "Clinic scheduling add-on", company: "brightpath", contact: "tom", value: 18000, stage: "won", probability: 100, createdDaysAgo: 70, closeInDays: -21, closedDaysAgo: 21 },
  { title: "Analytics workspace licenses", company: "lumen", contact: "sofia", value: 32000, stage: 1, probability: 30, createdDaysAgo: 19, closeInDays: 40 },
  { title: "Finance reporting package", company: "lumen", contact: "ethan", value: 24000, stage: "lost", probability: 0, createdDaysAgo: 64, closeInDays: -12, closedDaysAgo: 12, lostReason: "Budget" },
  { title: "Guest experience program", company: "harbor", contact: "grace", value: 27500, stage: 2, probability: 45, createdDaysAgo: 30, closeInDays: 20 },
  { title: "Procurement portal", company: "harbor", contact: "omar", value: 9500, stage: 0, probability: 10, createdDaysAgo: 3, closeInDays: null },
  { title: "Quality inspection suite", company: "cedar", contact: "hannah", value: 64000, stage: 3, probability: 80, createdDaysAgo: 58, closeInDays: 6 },
  { title: "Maintenance tracking", company: "cedar", contact: "luis", value: 21000, stage: "won", probability: 100, createdDaysAgo: 95, closeInDays: -48, closedDaysAgo: 48 },
  { title: "Program management platform", company: "atlas", contact: "aisha", value: 38000, stage: 1, probability: 35, createdDaysAgo: 14, closeInDays: 60 },
  { title: "Cold-chain monitoring", company: "greenleaf", contact: "chloe", value: 42000, stage: 2, probability: 55, createdDaysAgo: 26, closeInDays: 75 },
  { title: "Client onboarding workflow", company: "summit", contact: "ryan", value: 56000, stage: "won", probability: 100, createdDaysAgo: 41, closeInDays: -4, closedDaysAgo: 4 },
  { title: "Advisory team seats", company: "summit", contact: "nora", value: 15000, stage: "lost", probability: 0, createdDaysAgo: 80, closeInDays: -30, closedDaysAgo: 30, lostReason: "Chose a competitor" },
];

const ACTIVITIES: { deal: number; type: "call" | "email" | "meeting" | "note"; title: string; description: string; daysAgo: number }[] = [
  { deal: 0, type: "meeting", title: "Rollout planning session", description: "Agreed on a two-region rollout. Maya wants a signed order before the next quarter.", daysAgo: 2 },
  { deal: 0, type: "email", title: "Sent revised pricing", description: "Shared volume pricing for 120 vehicles.", daysAgo: 5 },
  { deal: 2, type: "call", title: "Discovery call with nursing leads", description: "Main pain point: paper intake forms at three clinics.", daysAgo: 9 },
  { deal: 2, type: "email", title: "Proposal sent", description: "Proposal and implementation timeline attached.", daysAgo: 3 },
  { deal: 4, type: "call", title: "Intro call", description: "Sofia is evaluating two vendors; decision expected next month.", daysAgo: 7 },
  { deal: 6, type: "meeting", title: "On-site walkthrough", description: "Toured the front desk and reviewed guest feedback flow.", daysAgo: 11 },
  { deal: 8, type: "call", title: "Legal review check-in", description: "Contract with their legal team; no open issues.", daysAgo: 1 },
  { deal: 10, type: "note", title: "Budget confirmed", description: "Aisha confirmed budget is approved for this fiscal year.", daysAgo: 4 },
  { deal: 11, type: "email", title: "Shared sensor spec sheet", description: "Requested by the supply chain team.", daysAgo: 6 },
  { deal: 12, type: "meeting", title: "Kickoff meeting", description: "Signed. Kickoff scheduled with the operations team.", daysAgo: 3 },
];

const TASKS: { deal: number | null; title: string; dueInDays: number; priority: "low" | "medium" | "high" }[] = [
  { deal: 0, title: "Send order form to Maya", dueInDays: 0, priority: "high" },
  { deal: 8, title: "Confirm contract redlines", dueInDays: -1, priority: "high" },
  { deal: 2, title: "Follow up on proposal", dueInDays: 2, priority: "medium" },
  { deal: 4, title: "Prepare comparison one-pager", dueInDays: 5, priority: "medium" },
  { deal: 11, title: "Schedule technical review", dueInDays: 7, priority: "low" },
  { deal: null, title: "Review pipeline for next week", dueInDays: 3, priority: "low" },
];

function daysFromNow(days: number): Date {
  return addDays(new Date(), days);
}

function friendly(error: unknown, fallback: string): Error {
  const msg = (error as { message?: string } | null)?.message;
  return new Error(msg ? `${fallback}: ${msg}` : fallback);
}

export async function loadSampleData(): Promise<SampleDataResult> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Please sign in again to load sample data.");

  // Reps only see their own deals (RLS), so the "workspace is empty" check below would pass for
  // them even in a populated workspace. Only admins and managers may load sample data.
  const { data: ctx, error: ctxError } = await supabase.rpc("get_my_context");
  if (ctxError) throw friendly(ctxError, "Couldn't check your workspace");
  const role = (Array.isArray(ctx) ? ctx[0] : ctx)?.role;
  if (role !== "admin" && role !== "manager") {
    throw new Error("Only workspace admins and managers can load sample data.");
  }

  const { count, error: countError } = await supabase.from("deals").select("id", { count: "exact", head: true });
  if (countError) throw friendly(countError, "Couldn't check your workspace");
  if ((count ?? 0) > 0) {
    throw new Error("Sample data can only be loaded into an empty workspace — this one already has deals.");
  }

  // Make sure a pipeline with stages exists.
  let { data: pipelines, error: pipelineError } = await supabase
    .from("pipelines")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1);
  if (pipelineError) throw friendly(pipelineError, "Couldn't load your pipeline");
  if (!pipelines?.length) {
    const { error } = await supabase.rpc("seed_default_pipeline");
    if (error) throw friendly(error, "Couldn't create a pipeline");
    ({ data: pipelines, error: pipelineError } = await supabase
      .from("pipelines")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1));
    if (pipelineError || !pipelines?.length) throw friendly(pipelineError, "Couldn't create a pipeline");
  }
  const pipelineId = pipelines[0].id as string;

  const { data: stageRows, error: stageError } = await supabase
    .from("pipeline_stages")
    .select("id, name, position, is_won, is_lost")
    .eq("pipeline_id", pipelineId)
    .order("position", { ascending: true });
  if (stageError) throw friendly(stageError, "Couldn't load pipeline stages");
  const stages = (stageRows ?? []) as StageRow[];
  const openStages = stages.filter((s) => !s.is_won && !s.is_lost);
  const wonStage = stages.find((s) => s.is_won);
  const lostStage = stages.find((s) => s.is_lost);
  if (!openStages.length) throw new Error("Your pipeline has no open stages. Add a stage first.");

  // Companies
  const { data: companies, error: companyError } = await supabase
    .from("companies")
    .insert(COMPANIES.map((c) => ({ name: c.name, industry: c.industry, website: c.website, created_by: userId })))
    .select("id, name");
  if (companyError) throw friendly(companyError, "Couldn't add sample companies");
  const companyId = new Map<string, string>();
  for (const c of COMPANIES) {
    const row = (companies ?? []).find((r: { name: string }) => r.name === c.name);
    if (row) companyId.set(c.key, row.id);
  }

  // Contacts
  const contactPayload = CONTACTS.map((c) => {
    const domain = COMPANIES.find((co) => co.key === c.company)!.website.replace("https://", "");
    return {
      first_name: c.first,
      last_name: c.last,
      email: `${c.first}.${c.last}@${domain}`.toLowerCase(),
      phone: null,
      position: c.position,
      tags: c.tags,
      company_id: companyId.get(c.company) ?? null,
      created_by: userId,
    };
  });
  const { data: contacts, error: contactError } = await supabase.from("contacts").insert(contactPayload).select("id, email");
  if (contactError) throw friendly(contactError, "Couldn't add sample contacts");
  const contactId = new Map<string, string>();
  CONTACTS.forEach((c, i) => {
    const row = (contacts ?? []).find((r: { email: string }) => r.email === contactPayload[i].email);
    if (row) contactId.set(c.key, row.id);
  });

  // Deals (won/lost deals fall back to the last open stage if the pipeline has no won/lost stage)
  const dealPayload = DEALS.map((d) => {
    let stageId: string;
    let wonAt: string | null = null;
    let lostAt: string | null = null;
    if (d.stage === "won" && wonStage) {
      stageId = wonStage.id;
      wonAt = daysFromNow(-(d.closedDaysAgo ?? 0)).toISOString();
    } else if (d.stage === "lost" && lostStage) {
      stageId = lostStage.id;
      lostAt = daysFromNow(-(d.closedDaysAgo ?? 0)).toISOString();
    } else {
      const idx = typeof d.stage === "number" ? d.stage : openStages.length - 1;
      stageId = openStages[Math.min(idx, openStages.length - 1)].id;
    }
    return {
      title: d.title,
      value: d.value,
      probability: d.probability,
      pipeline_id: pipelineId,
      stage_id: stageId,
      company_id: companyId.get(d.company) ?? null,
      contact_id: contactId.get(d.contact) ?? null,
      owner_id: userId,
      created_by: userId,
      created_at: daysFromNow(-d.createdDaysAgo).toISOString(),
      close_date: d.closeInDays === null ? null : format(daysFromNow(d.closeInDays), "yyyy-MM-dd"),
      ...(wonAt ? { won_at: wonAt } : {}),
      ...(lostAt ? { lost_at: lostAt, lost_reason: d.lostReason ?? null } : {}),
    };
  });
  const { data: deals, error: dealError } = await supabase.from("deals").insert(dealPayload).select("id, title");
  if (dealError) throw friendly(dealError, "Couldn't add sample deals");
  const dealIds = DEALS.map((d) => (deals ?? []).find((r: { title: string }) => r.title === d.title)?.id ?? null);

  // Activities
  const activityPayload = ACTIVITIES.map((a) => ({
    type: a.type,
    title: a.title,
    description: a.description,
    deal_id: dealIds[a.deal],
    contact_id: contactId.get(DEALS[a.deal].contact) ?? null,
    user_id: userId,
    created_at: daysFromNow(-a.daysAgo).toISOString(),
  }));
  const { error: activityError } = await supabase.from("activities").insert(activityPayload);
  if (activityError) throw friendly(activityError, "Couldn't add sample activities");

  // Tasks
  const taskPayload = TASKS.map((t) => {
    const due = daysFromNow(t.dueInDays);
    due.setHours(17, 0, 0, 0);
    return {
      title: t.title,
      due_date: due.toISOString(),
      priority: t.priority,
      completed: false,
      deal_id: t.deal === null ? null : dealIds[t.deal],
      contact_id: t.deal === null ? null : contactId.get(DEALS[t.deal].contact) ?? null,
      user_id: userId,
    };
  });
  const { error: taskError } = await supabase.from("tasks").insert(taskPayload);
  if (taskError) throw friendly(taskError, "Couldn't add sample tasks");

  return {
    companies: companies?.length ?? 0,
    contacts: contacts?.length ?? 0,
    deals: deals?.length ?? 0,
    activities: activityPayload.length,
    tasks: taskPayload.length,
  };
}
