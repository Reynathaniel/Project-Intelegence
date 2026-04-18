"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import { DashboardHeader, StatCard, EmptyState, LoadingSpinner } from "@/components/shared/dashboard-ui";
import { Truck, Package, Fuel, TrendingUp, Clock, CheckCircle2, AlertTriangle, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function LogisticsDashboardPage() {
  const supabase = createClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [usages, setUsages] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const load = async () => {
      const [req, rcv, use, rep] = await Promise.all([
        supabase.from("material_requests").select("*").eq("project_id", projectId).is("deleted_at", null).order("request_date", { ascending: false }).limit(50),
        supabase.from("material_receipts").select("*").eq("project_id", projectId).order("receipt_date", { ascending: false }).limit(100),
        supabase.from("material_usages").select("*").eq("project_id", projectId).order("usage_date", { ascending: false }).limit(100),
        supabase.from("daily_reports").select("id, report_date, author_name, data").eq("project_id", projectId).eq("discipline", "Logistics").eq("status", "Submitted").is("deleted_at", null).order("report_date", { ascending: false }).limit(30),
      ]);
      setRequests(req.data ?? []); setReceipts(rcv.data ?? []); setUsages(use.data ?? []); setReports(rep.data ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`log-${projectId}`).on("postgres_changes",
      { event: "*", schema: "public", table: "material_requests", filter: `project_id=eq.${projectId}` }, () => load()).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId]);

  const stats = useMemo(() => {
    const totalReqs = requests.length;
    const pendingReqs = requests.filter((r) => r.status === "Pending").length;
    const approvedReqs = requests.filter((r) => ["Approved", "Approved by CC", "Approved by CM", "Delivered"].includes(r.status)).length;
    const totalValue = receipts.reduce((s, r) => s + Number(r.total || 0), 0);
    const fuelIn = reports.reduce((s, r) => s + (r.data?.fuelIn?.reduce((x: number, f: any) => x + Number(f.volume || 0), 0) || 0), 0);
    const fuelOut = reports.reduce((s, r) => s + (r.data?.fuelOut?.reduce((x: number, f: any) => x + Number(f.volume || 0), 0) || 0), 0);

    const statusCount: Record<string, number> = {};
    requests.forEach((r) => { statusCount[r.status] = (statusCount[r.status] ?? 0) + 1; });
    const statusColors: Record<string, string> = {
      Pending: "#F59E0B", Approved: "#10B981", Rejected: "#EF4444",
      "Approved by CC": "#3B82F6", "Approved by CM": "#8B5CF6", Delivered: "#06B6D4",
    };
    const statusData = Object.entries(statusCount).map(([name, value]) => ({ name, value, color: statusColors[name] ?? "#666" }));

    const discCount: Record<string, number> = {};
    requests.forEach((r) => { if (r.discipline) discCount[r.discipline] = (discCount[r.discipline] ?? 0) + 1; });
    const discData = Object.entries(discCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

    return { totalReqs, pendingReqs, approvedReqs, totalValue, fuelIn, fuelOut, fuelBalance: fuelIn - fuelOut, statusData, discData };
  }, [requests, receipts, reports]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <DashboardHeader title="Logistics Hub" subtitle="Material Requests, Receipts & Fuel Tracking"
        icon={Truck} iconColor="text-blue-500" projectId={projectId} onProjectChange={setProjectId} />

      {loading ? <LoadingSpinner /> : !projectId ? (
        <EmptyState icon={Truck} title="Logistics Hub" description="Pilih project dulu." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Requests" value={stats.totalReqs.toString()} icon={<Package className="w-5 h-5" />} subtitle={`${stats.approvedReqs} approved`} color="blue" />
            <StatCard title="Pending" value={stats.pendingReqs.toString()} icon={<Clock className="w-5 h-5" />} subtitle="Awaiting approval" color="amber" />
            <StatCard title="Material Value" value={`Rp ${(stats.totalValue / 1000000).toFixed(1)}M`} icon={<DollarSign className="w-5 h-5" />} subtitle={`${stats.totalValue.toLocaleString('id-ID')} IDR`} color="emerald" />
            <StatCard title="Fuel Balance" value={`${stats.fuelBalance.toFixed(0)} L`} icon={<Fuel className="w-5 h-5" />} subtitle={`In: ${stats.fuelIn.toFixed(0)} / Out: ${stats.fuelOut.toFixed(0)}`} color="orange" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <Package className="w-4 h-4 text-blue-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Requests by Discipline</h3>
              </div>
              {stats.discData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={stats.discData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="name" tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#333" }} />
                    <YAxis tick={{ fill: "#666", fontSize: 10 }} axisLine={{ stroke: "#333" }} />
                    <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} />
                    <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Requests" />
                  </BarChart>
                </ResponsiveContainer>
              ) : <p className="text-neutral-600 text-sm text-center py-16">No requests yet.</p>}
            </div>

            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-5">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-bold text-white uppercase tracking-widest">Status Breakdown</h3>
              </div>
              {stats.statusData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={stats.statusData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value" stroke="none">
                        {stats.statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {stats.statusData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                        <span className="text-[10px] text-neutral-400">{item.name}</span>
                        <span className="text-[10px] text-white font-bold ml-auto">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : <p className="text-neutral-600 text-sm text-center py-16">No data.</p>}
            </div>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
            <div className="p-6 pb-4 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-500" /> Recent Material Requests
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-800 bg-neutral-900/50">
                    <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">SPB</th>
                    <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Item</th>
                    <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Volume</th>
                    <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Discipline</th>
                    <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Status</th>
                    <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.slice(0, 15).map((r) => (
                    <tr key={r.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20 transition-colors">
                      <td className="p-3 text-neutral-400 font-mono text-[11px]">{r.spb_no || "—"}</td>
                      <td className="p-3 text-white font-medium">{r.item_name}</td>
                      <td className="p-3 text-neutral-400 text-[11px]">{r.volume} {r.unit}</td>
                      <td className="p-3"><span className="text-[9px] font-bold uppercase px-2 py-1 rounded-full bg-neutral-800 text-neutral-400">{r.discipline || "—"}</span></td>
                      <td className="p-3">
                        <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${
                          r.status === "Pending" ? "bg-amber-500/10 text-amber-400" :
                          r.status === "Rejected" ? "bg-red-500/10 text-red-400" :
                          r.status === "Delivered" ? "bg-cyan-500/10 text-cyan-400" :
                          "bg-emerald-500/10 text-emerald-400"
                        }`}>{r.status}</span>
                      </td>
                      <td className="p-3 text-neutral-500 text-[11px]">{r.request_date}</td>
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-8 text-neutral-600 text-sm">Belum ada material request.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
