/**
 * Groq AI Copilot Service for Goom CRM
 * Connects to Groq Cloud API using high-performance LLM models (e.g., GPT-OSS-120B / Qwen)
 * to provide intelligent, contextual CRM insights, deal risk audits, revenue forecasts,
 * and executive email drafting based on the active company and pipeline data.
 */

const DEFAULT_GROQ_KEY = "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";

export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CRMContextData {
  companyName?: string;
  userName?: string;
  userRole?: string;
  totalValue?: number;
  winRate?: number;
  deals?: Array<{
    id?: string;
    title: string;
    value: number;
    stage_name?: string;
    stage_id?: string;
    probability?: number;
    company_name?: string;
    contact_name?: string;
    close_date?: string | null;
    priority?: string;
    notes?: string | null;
  }>;
  contacts?: Array<{
    id?: string;
    first_name: string;
    last_name: string;
    email?: string | null;
    phone?: string | null;
    position?: string | null;
    company_name?: string | null;
    tags?: string[];
  }>;
  companies?: Array<{
    id?: string;
    name: string;
    industry?: string | null;
    website?: string | null;
  }>;
  stages?: Array<{
    id: string;
    name: string;
    color?: string;
    count?: number;
    value?: number;
  }>;
  activities?: Array<{
    title: string;
    type: string;
    description: string;
    created_at?: string;
  }>;
  tasks?: Array<{
    title: string;
    due_date?: string;
    priority?: string;
    completed?: boolean;
  }>;
}

export interface CopilotResponse {
  content: string;
  actionPayload?: {
    type: "email" | "task" | "deal";
    label: string;
    textToCopy?: string;
  };
}

/**
 * Returns the effective Groq API Key
 */
export function getGroqApiKey(): string {
  const envKey =
    (import.meta.env.VITE_GROQ_API_KEY as string) ||
    (import.meta.env.groq_api_key as string);
  return envKey && envKey.startsWith("gsk_") ? envKey : DEFAULT_GROQ_KEY;
}

/**
 * Formats full CRM knowledge into an executive system prompt for Groq
 */
export function buildCRMSystemPrompt(ctx: CRMContextData): string {
  const company = ctx.companyName || "Goom Construction";
  const user = ctx.userName || "Team Member";
  const totalVal = ctx.totalValue ? `$${Number(ctx.totalValue).toLocaleString()}` : "$0";
  const winRate = ctx.winRate !== undefined ? `${ctx.winRate}%` : "38%";

  let dealsSummary = "No deals in pipeline yet.";
  if (ctx.deals && ctx.deals.length > 0) {
    dealsSummary = ctx.deals
      .map((d, i) => {
        const val = Number(d.value || 0).toLocaleString();
        const stage = d.stage_name || "Active";
        const comp = d.company_name ? ` (Account: ${d.company_name})` : "";
        const contact = d.contact_name ? ` [Contact: ${d.contact_name}]` : "";
        const prob = d.probability !== undefined ? ` [Prob: ${d.probability}%]` : "";
        const close = d.close_date ? ` [Target Close: ${d.close_date}]` : "";
        const notes = d.notes ? ` Notes: "${d.notes}"` : "";
        return `${i + 1}. **${d.title}** - $${val} | Stage: ${stage}${prob}${comp}${contact}${close}${notes}`;
      })
      .join("\n");
  }

  let contactsSummary = "No contacts listed.";
  if (ctx.contacts && ctx.contacts.length > 0) {
    contactsSummary = ctx.contacts
      .map((c, i) => {
        const full = `${c.first_name} ${c.last_name}`.trim();
        const role = c.position ? ` (${c.position})` : "";
        const comp = c.company_name ? ` at ${c.company_name}` : "";
        const email = c.email ? ` | Email: ${c.email}` : "";
        const phone = c.phone ? ` | Phone: ${c.phone}` : "";
        return `${i + 1}. ${full}${role}${comp}${email}${phone}`;
      })
      .join("\n");
  }

  let companiesSummary = "No companies recorded.";
  if (ctx.companies && ctx.companies.length > 0) {
    companiesSummary = ctx.companies
      .map((comp, i) => {
        const ind = comp.industry ? ` - Industry: ${comp.industry}` : "";
        const web = comp.website ? ` (${comp.website})` : "";
        return `${i + 1}. **${comp.name}**${ind}${web}`;
      })
      .join("\n");
  }

  let stagesSummary = "";
  if (ctx.stages && ctx.stages.length > 0) {
    stagesSummary = ctx.stages
      .map((s) => `• ${s.name}: ${s.count || 0} deals ($${Number(s.value || 0).toLocaleString()})`)
      .join("\n");
  }

  let activitiesSummary = "";
  if (ctx.activities && ctx.activities.length > 0) {
    activitiesSummary = ctx.activities
      .slice(0, 5)
      .map((a) => `• [${a.type.toUpperCase()}] ${a.title}: ${a.description}`)
      .join("\n");
  }

  let tasksSummary = "";
  if (ctx.tasks && ctx.tasks.length > 0) {
    tasksSummary = ctx.tasks
      .slice(0, 5)
      .map((t) => `• [${t.priority || "normal"}] ${t.title}${t.due_date ? ` (Due: ${t.due_date})` : ""}`)
      .join("\n");
  }

  return `You are Goom AI Copilot, the intelligent executive CRM advisor built directly into Goom CRM.
You are assisting ${user} at **${company}**.

### ACTIVE CRM WORKSPACE DATA:
- **Organization / Primary Company:** ${company}
- **Current User:** ${user} ${ctx.userRole ? `(${ctx.userRole})` : ""}
- **Total Pipeline Value:** ${totalVal} across ${ctx.deals?.length || 0} deals
- **Win Rate:** ${winRate}

### PIPELINE DEALS:
${dealsSummary}

### PIPELINE STAGES & DISTRIBUTION:
${stagesSummary || "Standard stages: Tender, Feasibility, Estimation, Proposal, Negotiation, Won"}

### CONTACTS & DECISION MAKERS:
${contactsSummary}

### COMPANIES / CLIENT ACCOUNTS:
${companiesSummary}

${activitiesSummary ? `### RECENT ACTIVITIES:\n${activitiesSummary}\n` : ""}
${tasksSummary ? `### OPEN TASKS:\n${tasksSummary}\n` : ""}

### YOUR OPERATING GUIDELINES:
1. **Be deeply contextual:** You have real-time access to ${company}'s actual pipeline, deals, contacts, values, and stages. Always quote the real figures, deal titles, stage names, and contact names when answering.
2. **Be decisive & executive:** Provide sharp, actionable insights. Prioritize high-value contracts, flag velocity bottlenecks, and calculate weighted projections accurately.
3. **Email Drafting:** When asked to draft an email or follow-up, write a polished, professional executive email addressed to the relevant contact, referencing the exact project or deal details. Use clear Subject and Body format.
4. **Markdown Formatting:** Use clean markdown: bold key metrics, use bullet points, and render comparison tables when breaking down multiple deals or stages.
5. **Tone:** Crisp, senior revenue strategist & operations advisor. No fluff or generic AI apologies.`;
}

/**
 * Sends a conversation to Groq API and returns intelligent response
 */
export async function askGroqCopilot(
  history: Array<{ role: "user" | "copilot"; content: string }>,
  currentPrompt: string,
  context: CRMContextData
): Promise<CopilotResponse> {
  const apiKey = getGroqApiKey();
  const systemPrompt = buildCRMSystemPrompt(context);

  // Convert conversation history to OpenAI/Groq format
  const groqMessages: GroqChatMessage[] = [
    { role: "system", content: systemPrompt },
  ];

  // Include last 6 turns for context continuity
  const recentHistory = history.slice(-6);
  for (const msg of recentHistory) {
    groqMessages.push({
      role: msg.role === "copilot" ? "assistant" : "user",
      content: msg.content,
    });
  }

  // Append user's current question
  groqMessages.push({
    role: "user",
    content: currentPrompt,
  });

  // Candidate models on Groq in priority order
  const candidateModels = [
    "openai/gpt-oss-120b",
    "openai/gpt-oss-20b",
    "qwen/qwen3.8-27b",
  ];

  let lastError: any = null;

  for (const model of candidateModels) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: groqMessages,
          temperature: 0.4,
          max_tokens: 1024,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.warn(`Groq model ${model} failed with status ${response.status}:`, errorData);
        lastError = errorData;
        continue; // Try next candidate model
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Empty response from Groq API");
      }

      // Check if response contains an email draft to offer one-click copy
      let actionPayload: CopilotResponse["actionPayload"] = undefined;
      const lower = content.toLowerCase();
      if (lower.includes("subject:") && (lower.includes("hi ") || lower.includes("dear ") || lower.includes("hello "))) {
        // Extract email portion if possible or provide copy action
        actionPayload = {
          type: "email",
          label: "Copy Email Draft 📋",
          textToCopy: content,
        };
      }

      return {
        content,
        actionPayload,
      };
    } catch (err) {
      console.warn(`Error querying Groq model ${model}:`, err);
      lastError = err;
    }
  }

  // Fallback if all Groq models failed
  console.error("All Groq models failed. Last error:", lastError);
  return generateIntelligentFallback(currentPrompt, context);
}

/**
 * High-quality fallback generator in case network or Groq outage occurs
 */
function generateIntelligentFallback(prompt: string, ctx: CRMContextData): CopilotResponse {
  const q = prompt.toLowerCase();
  const company = ctx.companyName || "Goom Construction";
  const deals = ctx.deals || [];
  const totalValue = ctx.totalValue || 0;
  const topDeal = [...deals].sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0];

  if (q.includes("email") || q.includes("draft") || q.includes("follow")) {
    const contact = topDeal?.contact_name || ctx.contacts?.[0]?.first_name || "Partner";
    const dealTitle = topDeal?.title || "Commercial Project";
    const emailText = `Subject: Update on ${dealTitle} — Next Steps & Timeline

Hi ${contact},

I wanted to follow up on our recent discussions regarding ${dealTitle} for ${company}.

Our engineering and estimation teams have reviewed the specifications. We are prepared to lock in the project schedule and finalize contract terms.

Could we connect for 15 minutes this Thursday or Friday to align on final sign-offs?

Best regards,
${ctx.userName || "Director of Operations"}
${company}`;

    return {
      content: `I've prepared a tailored follow-up email for **${contact}** regarding **${dealTitle}**:`,
      actionPayload: {
        type: "email",
        label: "Copy Email to Clipboard",
        textToCopy: emailText,
      },
    };
  }

  if (q.includes("deal") || q.includes("pipeline") || q.includes("summary") || q.includes("overview")) {
    return {
      content: `### 📊 ${company} Pipeline Summary

• **Active Opportunities:** ${deals.length} deals
• **Total Pipeline Value:** $${totalValue.toLocaleString()}
• **Top Priority Deal:** ${topDeal?.title || "None"} ($${Number(topDeal?.value || 0).toLocaleString()})
• **Win Rate Momentum:** ${ctx.winRate || 38}%

*Tip: Click any deal in your pipeline view to inspect stage milestones or trigger automated follow-ups.*`,
    };
  }

  return {
    content: `I've analyzed your request regarding **${company}**:\n\n• Current pipeline: **$${totalValue.toLocaleString()}** across **${deals.length} active opportunities**.\n• Top opportunity: **${topDeal?.title || "Active Deal"}** ($${Number(topDeal?.value || 0).toLocaleString()}).\n\nAsk me to draft emails, analyze deal risks, or break down revenue forecasts!`,
  };
}
