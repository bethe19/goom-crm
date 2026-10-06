import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://czuwelxmgjwbzwrqqlfv.supabase.co";
const SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6dXdlbHhtZ2p3Ynp3cnFxbGZ2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4OTgyMjIyOCwiZXhwIjoyMTA1Mzk4MjI4fQ.G2npqj0UOG52JlABeCpbRs85JjitVMRH24hTIX8Gjo0";

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  const { data: users, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error("User list error:", userError);
    return;
  }

  const targetEmail = "henok.bayou04@gmail.com".toLowerCase();
  const targetUser = users.users.find(u => u.email?.toLowerCase() === targetEmail);

  if (!targetUser) {
    console.log("User not found in auth.users. Available users:");
    users.users.forEach(u => console.log(`- ${u.id}: ${u.email}`));
    return;
  }

  console.log("Found user:", targetUser.id, targetUser.email);

  // Get profile
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", targetUser.id).single();
  console.log("Profile:", profile);

  // Get organization membership
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("*, organizations(*)")
    .eq("user_id", targetUser.id);
  console.log("Memberships:", JSON.stringify(memberships, null, 2));

  const orgId = profile?.current_organization_id || memberships?.[0]?.organization_id;
  console.log("Target orgId:", orgId);

  if (orgId) {
    // Get pipelines and stages
    const { data: pipelines } = await supabase.from("pipelines").select("*, pipeline_stages(*)").eq("organization_id", orgId);
    console.log("Pipelines:", JSON.stringify(pipelines, null, 2));

    // Get workspace members
    const { data: members } = await supabase.from("organization_members").select("user_id, role, profiles(*)").eq("organization_id", orgId);
    console.log("Org members:", JSON.stringify(members, null, 2));
  }
}

run().catch(console.error);
