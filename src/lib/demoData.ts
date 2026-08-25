export interface DemoDeal {
  id: string;
  title: string;
  value: number;
  probability: number;
  stage_id: string;
  stage_name: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  priority: "urgent" | "high" | "medium";
  close_date: string;
  created_at: string;
  notes?: string;
  ai_score?: number;
  ai_insight?: string;
}

export interface DemoContact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  position: string;
  company_name: string;
  tags: string[];
  created_at: string;
}

export interface DemoCompany {
  id: string;
  name: string;
  industry: string;
  website: string;
  created_at: string;
}

export interface DemoActivity {
  id: string;
  title: string;
  type: "call" | "email" | "meeting" | "note";
  description: string;
  deal_title?: string;
  contact_name?: string;
  created_at: string;
}

export interface DemoTask {
  id: string;
  title: string;
  due_date: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
  contact_name?: string;
  deal_title?: string;
}

export const DEMO_STAGES = [
  { id: "stage-prospect", name: "Prospect", color: "#3b82f6", position: 0 },
  { id: "stage-qualified", name: "Qualified", color: "#8b5cf6", position: 1 },
  { id: "stage-proposal", name: "Proposal", color: "#f97316", position: 2 },
  { id: "stage-negotiation", name: "Negotiation", color: "#eab308", position: 3 },
  { id: "stage-won", name: "Won", color: "#10b981", position: 4 },
  { id: "stage-lost", name: "Lost", color: "#ef4444", position: 5 },
];

export const INITIAL_DEMO_COMPANIES: DemoCompany[] = [
  { id: "comp-1", name: "Northstar Labs", industry: "Enterprise AI Infrastructure", website: "https://northstar.io", created_at: "2026-08-01T10:00:00Z" },
  { id: "comp-2", name: "Arc Systems", industry: "DevOps & Cloud Security", website: "https://arcsys.com", created_at: "2026-08-05T11:30:00Z" },
  { id: "comp-3", name: "Harbor & Co.", industry: "Fintech & Wealth Operations", website: "https://harbor.co", created_at: "2026-08-10T09:15:00Z" },
  { id: "comp-4", name: "Atlas Works", industry: "Autonomous Logistics", website: "https://atlas.works", created_at: "2026-08-14T14:20:00Z" },
  { id: "comp-5", name: "Orchid Health", industry: "HealthTech & Telehealth", website: "https://orchidhealth.org", created_at: "2026-08-18T16:45:00Z" },
  { id: "comp-6", name: "CyberShield AI", industry: "Zero Trust Cybersecurity", website: "https://cybershield.ai", created_at: "2026-08-22T08:00:00Z" },
  { id: "comp-7", name: "Nova Dynamics", industry: "Aerospace Robotics", website: "https://novadynamics.space", created_at: "2026-08-28T13:10:00Z" },
];

export const INITIAL_DEMO_CONTACTS: DemoContact[] = [
  { id: "cont-1", first_name: "Maya", last_name: "Chen", email: "maya@northstar.io", phone: "+1 (415) 555-0142", position: "VP of Engineering", company_name: "Northstar Labs", tags: ["Decision Maker", "VIP", "AI"], created_at: "2026-08-02T10:00:00Z" },
  { id: "cont-2", first_name: "Noah", last_name: "Williams", email: "noah@arcsys.com", phone: "+1 (650) 555-0198", position: "Head of Revenue Ops", company_name: "Arc Systems", tags: ["Evaluator", "Cloud"], created_at: "2026-08-06T11:30:00Z" },
  { id: "cont-3", first_name: "Sofia", last_name: "Miller", email: "sofia@harbor.co", phone: "+1 (212) 555-0177", position: "Chief Commercial Officer", company_name: "Harbor & Co.", tags: ["Executive Sponsor", "Fintech"], created_at: "2026-08-11T09:15:00Z" },
  { id: "cont-4", first_name: "Amara", last_name: "Davis", email: "amara@atlas.works", phone: "+1 (312) 555-0163", position: "Director of Business Dev", company_name: "Atlas Works", tags: ["Champion", "Logistics"], created_at: "2026-08-15T14:20:00Z" },
  { id: "cont-5", first_name: "Theo", last_name: "Martin", email: "theo@orchidhealth.org", phone: "+1 (617) 555-0189", position: "Growth Lead", company_name: "Orchid Health", tags: ["Procurement", "HealthTech"], created_at: "2026-08-19T16:45:00Z" },
  { id: "cont-6", first_name: "Elena", last_name: "Rostova", email: "elena@cybershield.ai", phone: "+1 (206) 555-0112", position: "VP Product Strategy", company_name: "CyberShield AI", tags: ["Key Stakeholder", "Security"], created_at: "2026-08-23T08:00:00Z" },
  { id: "cont-7", first_name: "Marcus", last_name: "Vance", email: "marcus@novadynamics.space", phone: "+1 (303) 555-0125", position: "Chief Operating Officer", company_name: "Nova Dynamics", tags: ["C-Suite", "Robotics"], created_at: "2026-08-29T13:10:00Z" },
];

export const INITIAL_DEMO_DEALS: DemoDeal[] = [
  {
    id: "deal-1",
    title: "Northstar Enterprise AI Rollout",
    value: 145000,
    probability: 90,
    stage_id: "stage-negotiation",
    stage_name: "Negotiation",
    company_name: "Northstar Labs",
    contact_name: "Maya Chen",
    contact_email: "maya@northstar.io",
    priority: "urgent",
    close_date: "2026-09-28",
    created_at: "2026-08-10T12:00:00Z",
    ai_score: 94,
    ai_insight: "High executive engagement. Final security redline received. 94% win probability if closed before month-end.",
  },
  {
    id: "deal-2",
    title: "Harbor & Co. Global Platform Expansion",
    value: 98000,
    probability: 75,
    stage_id: "stage-proposal",
    stage_name: "Proposal",
    company_name: "Harbor & Co.",
    contact_name: "Sofia Miller",
    contact_email: "sofia@harbor.co",
    priority: "high",
    close_date: "2026-10-05",
    created_at: "2026-08-14T09:30:00Z",
    ai_score: 82,
    ai_insight: "Proposal presented to board. Follow-up email recommended to confirm SLA terms.",
  },
  {
    id: "deal-3",
    title: "Atlas Works Logistics Telemetry Integration",
    value: 78500,
    probability: 85,
    stage_id: "stage-negotiation",
    stage_name: "Negotiation",
    company_name: "Atlas Works",
    contact_name: "Amara Davis",
    contact_email: "amara@atlas.works",
    priority: "high",
    close_date: "2026-09-25",
    created_at: "2026-08-18T14:15:00Z",
    ai_score: 89,
    ai_insight: "Contract in legal review. Fast-track with e-signature link to secure Q3 revenue.",
  },
  {
    id: "deal-4",
    title: "Arc Systems Cloud Security Gateway",
    value: 52000,
    probability: 60,
    stage_id: "stage-qualified",
    stage_name: "Qualified",
    company_name: "Arc Systems",
    contact_name: "Noah Williams",
    contact_email: "noah@arcsys.com",
    priority: "medium",
    close_date: "2026-10-18",
    created_at: "2026-08-20T10:45:00Z",
    ai_score: 68,
    ai_insight: "No touchpoint in 5 days. Suggested action: send benchmark report to Noah.",
  },
  {
    id: "deal-5",
    title: "CyberShield AI Zero-Trust Infrastructure",
    value: 120000,
    probability: 95,
    stage_id: "stage-won",
    stage_name: "Won",
    company_name: "CyberShield AI",
    contact_name: "Elena Rostova",
    contact_email: "elena@cybershield.ai",
    priority: "urgent",
    close_date: "2026-09-12",
    created_at: "2026-07-28T16:00:00Z",
    ai_score: 98,
    ai_insight: "Deal signed and invoice issued. Transition to onboarding team.",
  },
  {
    id: "deal-6",
    title: "Orchid Health Patient Data Pipeline",
    value: 64000,
    probability: 45,
    stage_id: "stage-prospect",
    stage_name: "Prospect",
    company_name: "Orchid Health",
    contact_name: "Theo Martin",
    contact_email: "theo@orchidhealth.org",
    priority: "medium",
    close_date: "2026-11-02",
    created_at: "2026-08-25T11:20:00Z",
    ai_score: 54,
    ai_insight: "Initial discovery call completed. Technical architecture session scheduled.",
  },
  {
    id: "deal-7",
    title: "Nova Dynamics Autonomous Fleet Ops",
    value: 185000,
    probability: 70,
    stage_id: "stage-proposal",
    stage_name: "Proposal",
    company_name: "Nova Dynamics",
    contact_name: "Marcus Vance",
    contact_email: "marcus@novadynamics.space",
    priority: "urgent",
    close_date: "2026-10-12",
    created_at: "2026-08-26T15:30:00Z",
    ai_score: 79,
    ai_insight: "Highest potential ARR deal. Custom enterprise pricing tier delivered yesterday.",
  },
  {
    id: "deal-8",
    title: "Apex Horizon Data Sync",
    value: 36000,
    probability: 30,
    stage_id: "stage-prospect",
    stage_name: "Prospect",
    company_name: "Apex Horizon",
    contact_name: "Chloe Bennett",
    contact_email: "chloe@apexhorizon.com",
    priority: "medium",
    close_date: "2026-11-15",
    created_at: "2026-09-02T10:00:00Z",
    ai_score: 42,
    ai_insight: "Lead generated from product tour. Awaiting budget sign-off.",
  },
  {
    id: "deal-9",
    title: "Quantum Bio Medical Automation",
    value: 88000,
    probability: 95,
    stage_id: "stage-won",
    stage_name: "Won",
    company_name: "Quantum Bio",
    contact_name: "Dr. Aris Thorne",
    contact_email: "aris@quantumbio.com",
    priority: "high",
    close_date: "2026-09-05",
    created_at: "2026-07-15T09:00:00Z",
    ai_score: 96,
    ai_insight: "Successfully deployed and live.",
  },
  {
    id: "deal-10",
    title: "Zenith Retail Omnichannel Suite",
    value: 48000,
    probability: 50,
    stage_id: "stage-qualified",
    stage_name: "Qualified",
    company_name: "Zenith Retail",
    contact_name: "Samantha Reed",
    contact_email: "samantha@zenithretail.com",
    priority: "medium",
    close_date: "2026-10-24",
    created_at: "2026-09-01T14:40:00Z",
    ai_score: 61,
    ai_insight: "Competitor comparison requested. Send 2026 ROI case study.",
  },
];

export const INITIAL_DEMO_ACTIVITIES: DemoActivity[] = [
  {
    id: "act-1",
    title: "Executive alignment call with Maya Chen",
    type: "call",
    description: "Discussed enterprise multi-region deployment and agreed on final contract volume.",
    deal_title: "Northstar Enterprise AI Rollout",
    contact_name: "Maya Chen",
    created_at: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
  },
  {
    id: "act-2",
    title: "Sent formal proposal & security whitepaper",
    type: "email",
    description: "Transmitted comprehensive proposal with SOC2 compliance breakdown to Sofia Miller.",
    deal_title: "Harbor & Co. Global Platform Expansion",
    contact_name: "Sofia Miller",
    created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
  },
  {
    id: "act-3",
    title: "Contract negotiation session with Legal",
    type: "meeting",
    description: "Virtual sync with Amara Davis and Atlas Works legal counsel. Approved indemnity clause.",
    deal_title: "Atlas Works Logistics Telemetry Integration",
    contact_name: "Amara Davis",
    created_at: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
  },
  {
    id: "act-4",
    title: "Zero-Trust Deployment Kickoff",
    type: "meeting",
    description: "Successfully celebrated deal close and introduced implementation lead to Elena Rostova.",
    deal_title: "CyberShield AI Zero-Trust Infrastructure",
    contact_name: "Elena Rostova",
    created_at: new Date(Date.now() - 26 * 3600 * 1000).toISOString(),
  },
  {
    id: "act-5",
    title: "Logged discovery notes for Nova Dynamics",
    type: "note",
    description: "Targeting 500 robot units by Q1 2027. Need custom API rate limits in quote.",
    deal_title: "Nova Dynamics Autonomous Fleet Ops",
    contact_name: "Marcus Vance",
    created_at: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
  },
];

export const INITIAL_DEMO_TASKS: DemoTask[] = [
  {
    id: "task-1",
    title: "Countersign Northstar Labs master service agreement",
    due_date: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    priority: "high",
    completed: false,
    contact_name: "Maya Chen",
    deal_title: "Northstar Enterprise AI Rollout",
  },
  {
    id: "task-2",
    title: "Follow up with Sofia on Harbor & Co SLA terms",
    due_date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
    priority: "high",
    completed: false,
    contact_name: "Sofia Miller",
    deal_title: "Harbor & Co. Global Platform Expansion",
  },
  {
    id: "task-3",
    title: "Schedule technical architecture review with Arc Systems",
    due_date: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
    priority: "medium",
    completed: false,
    contact_name: "Noah Williams",
    deal_title: "Arc Systems Cloud Security Gateway",
  },
  {
    id: "task-4",
    title: "Prepare custom enterprise quote for Nova Dynamics",
    due_date: new Date(Date.now() + 96 * 3600 * 1000).toISOString(),
    priority: "high",
    completed: false,
    contact_name: "Marcus Vance",
    deal_title: "Nova Dynamics Autonomous Fleet Ops",
  },
];

const STORAGE_KEYS = {
  DEALS: "goom_demo_deals_v1",
  COMPANIES: "goom_demo_companies_v1",
  CONTACTS: "goom_demo_contacts_v1",
  ACTIVITIES: "goom_demo_activities_v1",
  TASKS: "goom_demo_tasks_v1",
  FEEDBACK: "goom_demo_feedback_v1",
};

export function getDemoDeals(): DemoDeal[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.DEALS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(e);
  }
  return INITIAL_DEMO_DEALS;
}

export function saveDemoDeals(deals: DemoDeal[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DEALS, JSON.stringify(deals));
  } catch (e) {
    console.warn(e);
  }
}

export function getDemoContacts(): DemoContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTACTS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(e);
  }
  return INITIAL_DEMO_CONTACTS;
}

export function getDemoCompanies(): DemoCompany[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COMPANIES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(e);
  }
  return INITIAL_DEMO_COMPANIES;
}

export function getDemoActivities(): DemoActivity[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(e);
  }
  return INITIAL_DEMO_ACTIVITIES;
}

export function getDemoTasks(): DemoTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn(e);
  }
  return INITIAL_DEMO_TASKS;
}

export function resetDemoData(): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DEALS, JSON.stringify(INITIAL_DEMO_DEALS));
    localStorage.setItem(STORAGE_KEYS.CONTACTS, JSON.stringify(INITIAL_DEMO_CONTACTS));
    localStorage.setItem(STORAGE_KEYS.COMPANIES, JSON.stringify(INITIAL_DEMO_COMPANIES));
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(INITIAL_DEMO_ACTIVITIES));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(INITIAL_DEMO_TASKS));
  } catch (e) {
    console.warn(e);
  }
}

export function submitDemoFeedback(feedback: { rating: number; category: string; comment: string; email?: string }): void {
  try {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEYS.FEEDBACK) || "[]");
    existing.push({ ...feedback, created_at: new Date().toISOString() });
    localStorage.setItem(STORAGE_KEYS.FEEDBACK, JSON.stringify(existing));
  } catch (e) {
    console.warn(e);
  }
}

export async function seedSupabaseWithDemoData(supabaseClient: any, userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    let { data: pipeline } = await supabaseClient.from("pipelines").select("id").limit(1).maybeSingle();
    if (!pipeline) {
      const { data: newPipe, error: pipeErr } = await supabaseClient
        .from("pipelines")
        .insert({ name: "Sales Pipeline", created_by: userId })
        .select()
        .single();
      if (pipeErr) throw pipeErr;
      pipeline = newPipe;
    }

    const { data: existingStages } = await supabaseClient
      .from("pipeline_stages")
      .select("id, name")
      .eq("pipeline_id", pipeline.id);

    const stageMap: Record<string, string> = {};

    if (!existingStages || existingStages.length === 0) {
      const stageInserts = DEMO_STAGES.map((s) => ({
        pipeline_id: pipeline.id,
        name: s.name,
        color: s.color,
        position: s.position,
      }));
      const { data: insertedStages, error: stgErr } = await supabaseClient
        .from("pipeline_stages")
        .insert(stageInserts)
        .select();
      if (stgErr) throw stgErr;
      insertedStages.forEach((s: any) => {
        stageMap[s.name.toLowerCase()] = s.id;
      });
    } else {
      existingStages.forEach((s: any) => {
        stageMap[s.name.toLowerCase()] = s.id;
      });
    }

    const companyMap: Record<string, string> = {};
    for (const comp of INITIAL_DEMO_COMPANIES) {
      const { data: cData } = await supabaseClient
        .from("companies")
        .insert({
          name: comp.name,
          industry: comp.industry,
          website: comp.website,
          created_by: userId,
        })
        .select()
        .maybeSingle();
      if (cData) companyMap[comp.name] = cData.id;
    }

    const contactMap: Record<string, string> = {};
    for (const cont of INITIAL_DEMO_CONTACTS) {
      const { data: ctData } = await supabaseClient
        .from("contacts")
        .insert({
          first_name: cont.first_name,
          last_name: cont.last_name,
          email: cont.email,
          phone: cont.phone,
          position: cont.position,
          tags: cont.tags,
          company_id: companyMap[cont.company_name] || null,
          created_by: userId,
        })
        .select()
        .maybeSingle();
      if (ctData) contactMap[`${cont.first_name} ${cont.last_name}`] = ctData.id;
    }

    for (const d of INITIAL_DEMO_DEALS) {
      const matchedStageId =
        stageMap[d.stage_name.toLowerCase()] ||
        Object.values(stageMap)[0];

      await supabaseClient.from("deals").insert({
        title: d.title,
        value: d.value,
        probability: d.probability,
        pipeline_id: pipeline.id,
        stage_id: matchedStageId,
        company_id: companyMap[d.company_name] || null,
        contact_id: contactMap[d.contact_name] || null,
        close_date: d.close_date,
        owner_id: userId,
        created_by: userId,
      });
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
