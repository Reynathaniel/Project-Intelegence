import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OverviewClient } from "./overview-client";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Get user's orgs
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("org_id, role, organizations(id, name, slug, plan, monthly_extract_used, monthly_extract_limit)")
    .eq("user_id", user.id);

  if (!memberships || memberships.length === 0) {
    redirect("/onboarding");
  }

  const firstOrg = (memberships[0] as any).organizations;

  // Get projects for first org
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", firstOrg.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Get recent reports count
  const today = new Date().toISOString().split("T")[0];
  const { count: todayReports } = await supabase
    .from("daily_reports")
    .select("id", { count: "exact", head: true })
    .eq("org_id", firstOrg.id)
    .eq("report_date", today)
    .is("deleted_at", null);

  // Get total manpower
  const { count: totalManpower } = await supabase
    .from("manpower")
    .select("id", { count: "exact", head: true })
    .eq("org_id", firstOrg.id)
    .eq("active_status", "Active");

  return (
    <OverviewClient
      org={firstOrg}
      projects={projects ?? []}
      todayReports={todayReports ?? 0}
      totalManpower={totalManpower ?? 0}
      userName={user.user_metadata?.full_name ?? user.email ?? "Commander"}
    />
  );
}
