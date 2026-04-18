"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import { DashboardHeader, StatCard, EmptyState, LoadingSpinner } from "@/components/shared/dashboard-ui";
import { TrendingUp, Clock, DollarSign, Package, FileText, AlertTriangle, Target, Zap, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

type PMTab = "summary" | "schedule" | "cost" | "cashflow" | "procurement" | "claims";

export default function PMDashboardPage() {
  const { currentOrgId } = useUser();
  const supabase = createClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [tab, setTab] = useState<PMTab>("summary");
  const [schedule, setSchedule] = useState<any[]>([]);
  const [costs, setCosts] = useState<any[]>([]);
  const [cashFlow, setCashFlow] = useState<any[]>([]);
  const [procurement, setProcurement] = useState<any[]>([]);
  const [claims, setClaims] = useState<any[]>([]);
  const [intel, setIntel] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const load = async () => {
      const [sch, cst, cf, proc, cl, int] = await Promise.all([
        supabase.from("pm_schedules").select("*").eq("project_id", projectId).order("item_no"),
        supabase.from("pm_costs").select("*").eq("project_id", projectId),
        supabase.from("pm_cash_flows").select("*").eq("project_id", projectId).order("period"),
        supabase.from("pm_procurements").select("*").eq("project_id", projectId),
        supabase.from("pm_contract_claims").select("*").eq("project_id", projectId),
        supabase.from("pm_intelligence").select("*").eq("project_id", projectId).order("report_date", { ascending: false }).limit(1),
      ]);
      setSchedule(sch.data ?? []); setCosts(cst.data ?? []); setCashFlow(cf.data ?? []);
      setProcurement(proc.data ?? []); setClaims(cl.data ?? []); setIntel(int.data?.[0] ?? null);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`pm-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pm_schedules", filter: `project_id=eq.${projectId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "pm_costs", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  const summary = useMemo(() => {
    const critItems = schedule.filter((s) => s.is_critical);
    const avgProgress = schedule.length > 0 ? schedule.reduce((s, i) => s + Number(i.progress_pct || 0), 0) / schedule.length : 0;
    const totalBudget = costs.reduce((s, c) => s + Number(c.budget_cost || 0), 0);
    const totalActual = costs.reduce((s, c) => s + Number(c.actual_cost || 0), 0);
    const costVariance = totalBudget - totalActual;
    const highRisk = procurement.filter((p) => p.risk_level === "High").length;
    const totalEOT = claims.reduce((s, c) => s + Number(c.eot_days || 0), 0);
    const totalClaimValue = claims.reduce((s, c) => s + Number(c.cost_claim || 0), 0);
    const cfData = cashFlow.map((c) => ({
      period: c.period, planned: Number(c.planned_cost || 0) / 1e6, actual: Number(c.actual_cost || 0) / 1e6,
      cumulative: Number(c.cumulative_cost || 0) / 1e6,
    }));
    const riskData = [
      { name: "Low", value: procurement.filter((p) => p.risk_level === "Low").length, color: "#10B981" },
      { name: "Medium", value: procurement.filter((p) => p.risk_level === "Medium").length, color: "#F59E0B" },
      { name: "High", value: procurement.filter((p) => p.risk_level === "High").length, color: "#EF4444" },
    ].filter((d) => d.value > 0);
    return { avgProgress, critItems: critItems.length, totalBudget, totalActual, costVariance, highRisk, totalEOT, totalClaimValue, cfData, riskData, scheduleItems: schedule.length, costItems: costs.length };
  }, [schedule, costs, cashFlow, procurement, claims]);

  const tabs: { id: PMTab; label: string }[] = [
    { id: "summary", label: "Summary" }, { id: "schedule", label: `Schedule (${schedule.length})` },
    { id: "cost", label: `Cost (${costs.length})` }, { id: "cashflow", label: "Cash Flow" },
    { id: "procurement", label: `Procurement (${procurement.length})` }, { id: "claims", label: `Claims (${claims.length})` },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <DashboardHeader title="PM Intelligence" subtitle="Schedule, Cost, Cash Flow & Procurement Analysis"
        icon={TrendingUp} iconColor="text-emerald-500" projectId={projectId} onProjectChange={setProjectId} />

      {loading ? <LoadingSpinner /> : !projectId ? (
        <EmptyState icon={TrendingUp} title="PM Intelligence" description="Pilih project." />
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors cursor-pointer ${
                  tab === t.id ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-neutral-500 hover:text-white border border-transparent"
                }`}>{t.label}</button>
            ))}
          </div>

          {tab === "summary" && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Avg Progress" value={`${summary.avgProgress.toFixed(1)}%`} icon={<Target className="w-5 h-5" />} subtitle={`${summary.critItems} critical items`} color="emerald" />
                <StatCard title="Cost Variance" value={`${summary.costVariance >= 0 ? "+" : ""}${(summary.costVariance / 1e6).toFixed(1)}M`}
                  icon={summary.costVariance >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  subtitle={`Budget: ${(summary.totalBudget / 1e6).toFixed(1)}M`} color={summary.costVariance >= 0 ? "emerald" : "red"} />
                <StatCard title="Procurement Risk" value={`${summary.highRisk} High`} icon={<Package className="w-5 h-5" />} subtitle={`${procurement.length} items total`} color="amber" />
                <StatCard title="Claims" value={`${(summary.totalClaimValue / 1e6).toFixed(1)}M`} icon={<FileText className="w-5 h-5" />} subtitle={`EOT: ${summary.totalEOT} days`} color="violet" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-500" /> Cash Flow S-Curve
                  </h3>
                  {summary.cfData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <AreaChart data={summary.cfData}>
                        <defs>
                          <linearGradient id="planG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2} /><stop offset="95%" stopColor="#3B82F6" stopOpacity={0} /></linearGradient>
                          <linearGradient id="actG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.2} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="period" tick={{ fill: "#666", fontSize: 10 }} />
                        <YAxis tick={{ fill: "#666", fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} />
                        <Area type="monotone" dataKey="planned" stroke="#3B82F6" fill="url(#planG)" strokeWidth={2} name="Planned (M)" />
                        <Area type="monotone" dataKey="actual" stroke="#10B981" fill="url(#actG)" strokeWidth={2} name="Actual (M)" />
                        <Line type="monotone" dataKey="cumulative" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="4 2" name="Cumulative (M)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <p className="text-neutral-600 text-sm text-center py-16">No cash flow data.</p>}
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" /> Procurement Risk
                  </h3>
                  {summary.riskData.length > 0 ? (
                    <>
                      <ResponsiveContainer width="100%" height={160}>
                        <PieChart><Pie data={summary.riskData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" stroke="none">
                          {summary.riskData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie><Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} /></PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-1.5 mt-4">{summary.riskData.map((d) => (
                        <div key={d.name} className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          <span className="text-[11px] text-neutral-400">{d.name}</span>
                          <span className="text-[11px] text-white font-bold ml-auto">{d.value}</span>
                        </div>
                      ))}</div>
                    </>
                  ) : <p className="text-neutral-600 text-sm text-center py-12">No data.</p>}
                </div>
              </div>

              {/* AI Intelligence summary */}
              {intel && (
                <div className="bg-neutral-900 border border-violet-500/20 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-violet-500" /> AI Intelligence Report ({intel.report_date})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {intel.summary?.criticalIssues?.map((issue: string, i: number) => (
                      <div key={i} className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl text-xs text-red-300 flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-red-500" />
                        <span>{issue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Schedule tab */}
          {tab === "schedule" && (
            <DataTable headers={["No", "Activity", "Duration", "Start", "Finish", "Progress", "Critical"]}
              rows={schedule.map((s) => [s.item_no, s.activity, `${s.duration_days}d`, s.start_date, s.finish_date,
                <div key={s.id} className="flex items-center gap-2"><div className="w-16 h-1.5 bg-neutral-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.progress_pct}%` }} /></div><span className="text-[10px]">{s.progress_pct}%</span></div>,
                s.is_critical ? <span key={s.id} className="text-red-400 text-[10px] font-bold">YES</span> : <span key={s.id} className="text-neutral-600 text-[10px]">no</span>
              ])} emptyMsg="No schedule items." />
          )}

          {/* Cost tab */}
          {tab === "cost" && (
            <DataTable headers={["Item", "Budget", "Actual", "Variance", "Progress", "Ratio"]}
              rows={costs.map((c) => [c.item, `${(Number(c.budget_cost) / 1e6).toFixed(2)}M`, `${(Number(c.actual_cost) / 1e6).toFixed(2)}M`,
                <span key={c.id} className={Number(c.variance) >= 0 ? "text-emerald-400" : "text-red-400"}>{(Number(c.variance) / 1e6).toFixed(2)}M</span>,
                `${c.progress_pct}%`, c.cost_progress_ratio ?? "—"
              ])} emptyMsg="No cost items." />
          )}

          {/* Cash Flow tab */}
          {tab === "cashflow" && (
            <DataTable headers={["Period", "Planned Progress", "Actual Progress", "Planned Cost", "Actual Cost", "Cumulative"]}
              rows={cashFlow.map((c) => [c.period, `${c.planned_progress}%`, `${c.actual_progress}%`,
                `${(Number(c.planned_cost) / 1e6).toFixed(2)}M`, `${(Number(c.actual_cost) / 1e6).toFixed(2)}M`, `${(Number(c.cumulative_cost) / 1e6).toFixed(2)}M`
              ])} emptyMsg="No cash flow data." />
          )}

          {/* Procurement tab */}
          {tab === "procurement" && (
            <DataTable headers={["Material", "Status", "PO Date", "Delivery", "Delay", "Risk"]}
              rows={procurement.map((p) => [p.material, p.status, p.po_date, p.delivery_date, p.delay_days > 0 ? <span key={p.id} className="text-red-400">{p.delay_days}d</span> : "0d",
                <span key={p.id} className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${p.risk_level === "High" ? "bg-red-500/10 text-red-400" : p.risk_level === "Medium" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}`}>{p.risk_level}</span>
              ])} emptyMsg="No procurement items." />
          )}

          {/* Claims tab */}
          {tab === "claims" && (
            <DataTable headers={["Issue", "Type", "Responsible", "EOT (days)", "Cost Claim", "Status"]}
              rows={claims.map((c) => [c.issue, c.claim_type,c.responsible, c.eot_days, `${(Number(c.cost_claim) / 1e3).toFixed(0)}K`, c.status
              ])} emptyMsg="No claims." />
          )}
        </>
      )}
    </div>
  );
}

function DataTable({ headers, rows, emptyMsg }: { headers: string[]; rows: any[][]; emptyMsg: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-neutral-800 bg-neutral-900/50">
            {headers.map((h) => <th key={h} className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length > 0 ? rows.map((row, i) => (
              <tr key={i} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                {row.map((cell, j) => <td key={j} className="p-3 text-neutral-300 text-[12px]">{cell}</td>)}
              </tr>
            )) : <tr><td colSpan={headers.length} className="text-center py-8 text-neutral-600 text-sm">{emptyMsg}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
