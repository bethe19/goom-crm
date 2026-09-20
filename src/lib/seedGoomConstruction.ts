import { SupabaseClient } from "@supabase/supabase-js";

export const GOOM_CONSTRUCTION_DATA = {
  company: {
    name: "Goom Construction",
    industry: "Commercial Contracting & Infrastructure",
    website: "https://goomconstruction.com",
  },
  partnerCompanies: [
    { name: "Apex Commercial Development", industry: "Commercial Real Estate Development", website: "https://apexdevelopment.com" },
    { name: "Oakridge Luxury Estates", industry: "High-End Residential & Mixed-Use", website: "https://oakridge-estates.com" },
    { name: "Metropolitan Transit Authority", industry: "Public Infrastructure & Transportation", website: "https://mta-transit.gov" },
    { name: "Harbor Logistics & Port Terminal", industry: "Supply Chain & Heavy Industrial", website: "https://harborlogistics.com" },
    { name: "Greenfield Healthcare Trust", industry: "Healthcare & Hospital Facilities", website: "https://greenfieldhealth.org" },
  ],
  stages: [
    { name: "Tender & Lead In", color: "#3b82f6", position: 0 },
    { name: "Site Inspection & Feasibility", color: "#8b5cf6", position: 1 },
    { name: "Blueprint & Estimation", color: "#06b6d4", position: 2 },
    { name: "Proposal / Bid Submitted", color: "#f59e0b", position: 3 },
    { name: "Contract Negotiation", color: "#ec4899", position: 4 },
    { name: "Won (Contract Signed)", color: "#10b981", position: 5 },
    { name: "Lost", color: "#ef4444", position: 6 },
  ],
  contacts: [
    {
      first_name: "Marcus",
      last_name: "Vance",
      email: "m.vance@apexdevelopment.com",
      phone: "+1 (415) 890-2341",
      position: "Senior VP of Development",
      company_name: "Apex Commercial Development",
      tags: ["Decision Maker", "Commercial", "VIP"],
    },
    {
      first_name: "Elena",
      last_name: "Rostova",
      email: "e.rostova@oakridge-estates.com",
      phone: "+1 (312) 674-8890",
      position: "Director of Capital Projects",
      company_name: "Oakridge Luxury Estates",
      tags: ["Executive Sponsor", "Luxury Residential"],
    },
    {
      first_name: "David",
      last_name: "Kalu",
      email: "d.kalu@goomconstruction.com",
      phone: "+1 (212) 555-4019",
      position: "Chief Estimator & Structural Engineer",
      company_name: "Goom Construction",
      tags: ["Internal Team", "Engineering Lead"],
    },
    {
      first_name: "Sarah",
      last_name: "Jenkins",
      email: "sjenkins@mta-transit.gov",
      phone: "+1 (202) 431-7720",
      position: "Chief Infrastructure Officer",
      company_name: "Metropolitan Transit Authority",
      tags: ["Government Tender", "Procurement"],
    },
    {
      first_name: "Ahmed",
      last_name: "Al-Mansoor",
      email: "ahmed@harborlogistics.com",
      phone: "+1 (713) 902-1145",
      position: "Managing Director of Facilities",
      company_name: "Harbor Logistics & Port Terminal",
      tags: ["Industrial", "High Budget"],
    },
    {
      first_name: "Sophia",
      last_name: "Chen",
      email: "schen@greenfieldhealth.org",
      phone: "+1 (617) 388-9022",
      position: "Director of Hospital Operations",
      company_name: "Greenfield Healthcare Trust",
      tags: ["Healthcare", "Seismic Retrofit"],
    },
  ],
  deals: [
    {
      title: "Downtown Commercial Tower - Phase 2",
      value: 480000,
      probability: 85,
      stage_name: "Contract Negotiation",
      company_name: "Apex Commercial Development",
      contact_name: "Marcus Vance",
      notes: "Structural steel framing & concrete core package. Finalizing material cost-escalation clause before sign-off.",
      close_days: 25,
    },
    {
      title: "Oakridge Luxury Residential Complex",
      value: 750000,
      probability: 60,
      stage_name: "Blueprint & Estimation",
      company_name: "Oakridge Luxury Estates",
      contact_name: "Elena Rostova",
      notes: "24-unit luxury residential development. Geotechnical soil compaction passed. Architectural bill of quantities in progress.",
      close_days: 60,
    },
    {
      title: "Greenfield Medical Center Seismic Retrofit",
      value: 620000,
      probability: 100,
      stage_name: "Won (Contract Signed)",
      company_name: "Greenfield Healthcare Trust",
      contact_name: "Sophia Chen",
      notes: "Contract awarded & executed. Site mobilization and safety barricades underway. Structural steel dampeners ordered.",
      close_days: -10,
    },
    {
      title: "Metropolitan Transit Hub Glazing & Facade",
      value: 295000,
      probability: 75,
      stage_name: "Proposal / Bid Submitted",
      company_name: "Metropolitan Transit Authority",
      contact_name: "Sarah Jenkins",
      notes: "Public tender submitted. Goom Construction scored #1 in technical review. Price bid opening scheduled next Tuesday.",
      close_days: 35,
    },
    {
      title: "Harbor Logistics Center Warehouse Expansion",
      value: 340000,
      probability: 40,
      stage_name: "Site Inspection & Feasibility",
      company_name: "Harbor Logistics & Port Terminal",
      contact_name: "Ahmed Al-Mansoor",
      notes: "85,000 sq ft industrial slab extension with heavy-duty loading bays. Feasibility study underway.",
      close_days: 75,
    },
    {
      title: "Tech Park Substation Civil Works",
      value: 185000,
      probability: 30,
      stage_name: "Tender & Lead In",
      company_name: "Apex Commercial Development",
      contact_name: "Marcus Vance",
      notes: "Foundational concrete footings and perimeter blast wall tender for sub-station facility.",
      close_days: 90,
    },
  ],
  activities: [
    {
      title: "Contract Redline Alignment Call",
      type: "call",
      description: "Discussed steel escalation clauses with Marcus Vance. Agreed on a 4% cap on structural materials.",
      deal_title: "Downtown Commercial Tower - Phase 2",
      contact_name: "Marcus Vance",
    },
    {
      title: "Seismic Engineering Site Walkthrough",
      type: "meeting",
      description: "Completed pre-construction walkthrough with Sophia Chen and hospital operations team. Safety clear.",
      deal_title: "Greenfield Medical Center Seismic Retrofit",
      contact_name: "Sophia Chen",
    },
    {
      title: "BOQ & Warranty Package Submission",
      type: "email",
      description: "Submitted formal Bill of Quantities and 10-year thermal glass warranty packet to Sarah Jenkins.",
      deal_title: "Metropolitan Transit Hub Glazing & Facade",
      contact_name: "Sarah Jenkins",
    },
    {
      title: "Geotechnical Soil Density Report",
      type: "note",
      description: "Chief Estimator David Kalu confirmed soil compaction rating exceeds 98% Proctor standard.",
      deal_title: "Oakridge Luxury Residential Complex",
      contact_name: "Elena Rostova",
    },
  ],
  tasks: [
    {
      title: "Send final contract execution packet to Marcus Vance",
      description: "Incorporate 4% steel cap amendment into final agreement",
      priority: "high",
      due_days: 3,
      deal_title: "Downtown Commercial Tower - Phase 2",
    },
    {
      title: "Prepare Transit Hub technical oral presentation",
      description: "Prepare slide deck with structural glazing safety tests",
      priority: "high",
      due_days: 5,
      deal_title: "Metropolitan Transit Hub Glazing & Facade",
    },
    {
      title: "Schedule geotechnical site drill for Harbor Logistics",
      description: "Coordinate with core sampling rig for slab load-bearing survey",
      priority: "medium",
      due_days: 8,
      deal_title: "Harbor Logistics Center Warehouse Expansion",
    },
    {
      title: "Inspect subcontractor liability certificates",
      description: "Verify $5M insurance coverage before Phase 1 seismic mobilization",
      priority: "medium",
      due_days: 4,
      deal_title: "Greenfield Medical Center Seismic Retrofit",
    },
  ],
};

/**
 * Seeds Supabase live database with Goom Construction data
 */
export async function seedGoomConstructionWorkspace(
  supabase: SupabaseClient,
  userId: string
): Promise<{ success: boolean; message: string; error?: any }> {
  try {
    // 1. Update Profile to Goom Construction
    await supabase
      .from("profiles")
      .upsert({
        user_id: userId,
        full_name: "Goom Construction Admin",
        company: "Goom Construction",
        updated_at: new Date().toISOString(),
      });

    // 2. Setup Companies
    const companyMap: Record<string, string> = {};
    const allCompanies = [GOOM_CONSTRUCTION_DATA.company, ...GOOM_CONSTRUCTION_DATA.partnerCompanies];

    for (const comp of allCompanies) {
      const { data: existing } = await supabase
        .from("companies")
        .select("id")
        .eq("name", comp.name)
        .eq("created_by", userId)
        .maybeSingle();

      if (existing) {
        companyMap[comp.name] = existing.id;
      } else {
        const { data: created, error } = await supabase
          .from("companies")
          .insert({
            name: comp.name,
            industry: comp.industry,
            website: comp.website,
            created_by: userId,
          })
          .select("id")
          .single();
        if (!error && created) {
          companyMap[comp.name] = created.id;
        }
      }
    }

    // 3. Setup Pipeline & Stages
    let { data: pipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("created_by", userId)
      .maybeSingle();

    if (!pipeline) {
      const { data: newPipe, error: pipeErr } = await supabase
        .from("pipelines")
        .insert({
          name: "Commercial Construction Pipeline",
          created_by: userId,
        })
        .select("id")
        .single();
      if (pipeErr) throw pipeErr;
      pipeline = newPipe;
    }

    const { data: existingStages } = await supabase
      .from("pipeline_stages")
      .select("id, name")
      .eq("pipeline_id", pipeline.id);

    const stageMap: Record<string, string> = {};
    if (!existingStages || existingStages.length === 0) {
      for (const stg of GOOM_CONSTRUCTION_DATA.stages) {
        const { data: createdStg } = await supabase
          .from("pipeline_stages")
          .insert({
            pipeline_id: pipeline.id,
            name: stg.name,
            color: stg.color,
            position: stg.position,
          })
          .select("id, name")
          .single();
        if (createdStg) {
          stageMap[createdStg.name] = createdStg.id;
        }
      }
    } else {
      existingStages.forEach((s) => {
        stageMap[s.name] = s.id;
      });
    }

    // 4. Setup Contacts
    const contactMap: Record<string, string> = {};
    for (const c of GOOM_CONSTRUCTION_DATA.contacts) {
      const fullName = `${c.first_name} ${c.last_name}`;
      const compId = companyMap[c.company_name] || null;

      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("first_name", c.first_name)
        .eq("last_name", c.last_name)
        .eq("created_by", userId)
        .maybeSingle();

      if (existingContact) {
        contactMap[fullName] = existingContact.id;
      } else {
        const { data: createdContact } = await supabase
          .from("contacts")
          .insert({
            first_name: c.first_name,
            last_name: c.last_name,
            email: c.email,
            phone: c.phone,
            position: c.position,
            tags: c.tags,
            company_id: compId,
            created_by: userId,
          })
          .select("id")
          .single();
        if (createdContact) {
          contactMap[fullName] = createdContact.id;
        }
      }
    }

    // 5. Setup Deals
    const dealMap: Record<string, string> = {};
    const now = new Date();

    for (const d of GOOM_CONSTRUCTION_DATA.deals) {
      const { data: existingDeal } = await supabase
        .from("deals")
        .select("id")
        .eq("title", d.title)
        .eq("created_by", userId)
        .maybeSingle();

      if (existingDeal) {
        dealMap[d.title] = existingDeal.id;
      } else {
        const closeDate = new Date(now.getTime() + d.close_days * 86400000)
          .toISOString()
          .split("T")[0];

        const stageId = stageMap[d.stage_name] || Object.values(stageMap)[0];
        const compId = companyMap[d.company_name] || null;
        const contactId = contactMap[d.contact_name] || null;

        const { data: createdDeal } = await supabase
          .from("deals")
          .insert({
            title: d.title,
            value: d.value,
            probability: d.probability,
            stage_id: stageId,
            pipeline_id: pipeline.id,
            company_id: compId,
            contact_id: contactId,
            owner_id: userId,
            created_by: userId,
            close_date: closeDate,
            notes: d.notes,
          })
          .select("id")
          .single();

        if (createdDeal) {
          dealMap[d.title] = createdDeal.id;
        }
      }
    }

    // 6. Setup Activities
    for (const act of GOOM_CONSTRUCTION_DATA.activities) {
      const dealId = dealMap[act.deal_title] || null;
      const contactId = contactMap[act.contact_name] || null;

      await supabase.from("activities").insert({
        title: act.title,
        type: act.type,
        description: act.description,
        deal_id: dealId,
        contact_id: contactId,
        user_id: userId,
      });
    }

    // 7. Setup Tasks
    for (const tsk of GOOM_CONSTRUCTION_DATA.tasks) {
      const dealId = dealMap[tsk.deal_title] || null;
      const dueDate = new Date(now.getTime() + tsk.due_days * 86400000).toISOString();

      await supabase.from("tasks").insert({
        title: tsk.title,
        description: tsk.description,
        priority: tsk.priority,
        completed: false,
        due_date: dueDate,
        deal_id: dealId,
        user_id: userId,
      });
    }

    return {
      success: true,
      message: "Goom Construction workspace successfully initialized with $2,670,000 active pipeline!",
    };
  } catch (err: any) {
    console.error("Error seeding Goom Construction data:", err);
    return {
      success: false,
      message: err?.message || "Failed to seed Goom Construction data",
      error: err,
    };
  }
}
