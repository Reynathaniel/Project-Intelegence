"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import { DashboardHeader, StatCard, EmptyState, LoadingSpinner } from "@/components/shared/dashboard-ui";
import { Users, UserCheck, UserX, MapPin, Calendar, Search, Clock, BadgeCheck } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

export default function HRDashboardPage() {
  const { currentOrgId } = useUser();
  const supabase = createClient();
  const [projectId, setProjectId] = useState<string | null>(null);
  const [manpower, setManpower] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterClass, setFilterClass] = useState<"All" | "Direct" | "Indirect">("All");
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState<"manpower" | "attendance">("manpower");

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    const load = async () => {
      const [mp, att, rep] = await Promise.all([
        supabase.from("manpower").select("*").eq("project_id", projectId).order("name"),
        supabase.from("attendance").select("*").eq("project_id", projectId).eq("attendance_date", selectedDate).order("captured_at", { ascending: false }),
        supabase.from("daily_reports").select("id, report_date, data").eq("project_id", projectId).eq("discipline", "HR").eq("status", "Submitted").is("deleted_at", null).order("report_date", { ascending: false }).limit(30),
      ]);
      setManpower(mp.data ?? []); setAttendance(att.data ?? []); setReports(rep.data ?? []);
      setLoading(false);
    };
    load();
    const ch = supabase.channel(`hr-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "manpower", filter: `project_id=eq.${projectId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [projectId, selectedDate]);

  const stats = useMemo(() => {
    const active = manpower.filter((m) => m.active_status === "Active");
    const direct = active.filter((m) => m.classification === "Direct").length;
    const indirect = active.filter((m) => m.classification === "Indirect").length;
    const onSite = active.filter((m) => m.site_status === "On Site").length;
    const resigned = manpower.filter((m) => m.active_status === "Resign").length;
    const checkedIn = new Set(attendance.filter((a) => a.type === "Check-in").map((a) => a.user_id)).size;

    const posCount: Record<string, number> = {};
    active.forEach((m) => { if (m.position) posCount[m.position] = (posCount[m.position] ?? 0) + 1; });
    const posData = Object.entries(posCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);

    const classData = [
      { name: "Direct", value: direct, color: "#10B981" },
      { name: "Indirect", value: indirect, color: "#3B82F6" },
    ].filter((d) => d.value > 0);

    return { total: active.length, direct, indirect, onSite, resigned, checkedIn, posData, classData };
  }, [manpower, attendance]);

  const filteredMP = useMemo(() => {
    let list = manpower.filter((m) => m.active_status === "Active");
    if (filterClass !== "All") list = list.filter((m) => m.classification === filterClass);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((m) => m.name?.toLowerCase().includes(q) || m.manpower_id?.toLowerCase().includes(q) || m.position?.toLowerCase().includes(q));
    }
    return list;
  }, [manpower, filterClass, search]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl space-y-6">
      <DashboardHeader title="HR & Manpower" subtitle="Personnel Management & Attendance Tracking"
        icon={Users} iconColor="text-pink-500" projectId={projectId} onProjectChange={setProjectId} />

      {loading ? <LoadingSpinner /> : !projectId ? (
        <EmptyState icon={Users} title="HR & Manpower" description="Pilih project." />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Active" value={stats.total.toString()} icon={<Users className="w-5 h-5" />} subtitle={`${stats.resigned} resigned`} color="pink" />
            <StatCard title="Direct" value={stats.direct.toString()} icon={<UserCheck className="w-5 h-5" />} subtitle={`${stats.indirect} indirect`} color="emerald" />
            <StatCard title="On Site" value={stats.onSite.toString()} icon={<MapPin className="w-5 h-5" />} subtitle={`${stats.total - stats.onSite} off site`} color="blue" />
            <StatCard title="Checked In Today" value={stats.checkedIn.toString()} icon={<Clock className="w-5 h-5" />} subtitle={selectedDate} color="violet" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {(["manpower", "attendance"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  activeTab === tab ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" : "text-neutral-500 hover:text-white border border-transparent"
                }`}>{tab === "manpower" ? `Manpower (${stats.total})` : `Attendance`}</button>
            ))}
          </div>

          {activeTab === "manpower" ? (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5">Position Breakdown</h3>
                  {stats.posData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={stats.posData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis type="number" tick={{ fill: "#666", fontSize: 10 }} />
                        <YAxis dataKey="name" type="category" tick={{ fill: "#999", fontSize: 10 }} width={100} />
                        <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} />
                        <Bar dataKey="value" fill="#EC4899" radius={[0, 4, 4, 0]} name="Personnel" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="text-neutral-600 text-sm text-center py-12">No data.</p>}
                </div>
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-5">Classification</h3>
                  {stats.classData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart><Pie data={stats.classData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" stroke="none">
                        {stats.classData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie><Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", fontSize: "11px" }} /></PieChart>
                    </ResponsiveContainer>
                  ) : null}
                  <div className="space-y-1.5 mt-4">
                    {stats.classData.map((d) => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                        <span className="text-[11px] text-neutral-400">{d.name}</span>
                        <span className="text-[11px] text-white font-bold ml-auto">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Search + filter + table */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row gap-3">
                  <div className="flex items-center gap-2 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl flex-1">
                    <Search className="w-4 h-4 text-neutral-500" />
                    <input type="text" placeholder="Cari nama, NIK, posisi..." value={search} onChange={(e) => setSearch(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs text-white w-full placeholder:text-neutral-600" />
                  </div>
                  <div className="flex gap-2">
                    {(["All", "Direct", "Indirect"] as const).map((c) => (
                      <button key={c} onClick={() => setFilterClass(c)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold uppercase cursor-pointer transition-colors ${
                          filterClass === c ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "text-neutral-500 border border-neutral-800 hover:text-white"
                        }`}>{c}</button>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-800 bg-neutral-900/50">
                        <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">NIK</th>
                        <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Nama</th>
                        <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Posisi</th>
                        <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Class</th>
                        <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Site</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMP.slice(0, 30).map((m) => (
                        <tr key={m.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                          <td className="p-3 text-neutral-400 font-mono text-[11px]">{m.manpower_id}</td>
                          <td className="p-3 text-white font-medium">{m.name}</td>
                          <td className="p-3 text-neutral-400 text-[11px]">{m.position}</td>
                          <td className="p-3"><span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${m.classification === "Direct" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>{m.classification}</span></td>
                          <td className="p-3"><span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${m.site_status === "On Site" ? "bg-emerald-500/10 text-emerald-400" : "bg-neutral-800 text-neutral-500"}`}>{m.site_status}</span></td>
                        </tr>
                      ))}
                      {filteredMP.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-neutral-600 text-sm">Tidak ada data manpower.</td></tr>}
                    </tbody>
                  </table>
                  {filteredMP.length > 30 && <p className="text-center py-3 text-[11px] text-neutral-600">Showing 30 of {filteredMP.length}. Use search to narrow.</p>}
                </div>
              </div>
            </>
          ) : (
            /* Attendance tab */
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-xl text-xs text-white" />
                <span className="text-xs text-neutral-500">{attendance.length} records</span>
              </div>
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-800 bg-neutral-900/50">
                      <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Name</th>
                      <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Type</th>
                      <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Time</th>
                      <th className="text-left p-3 text-[10px] font-mono text-neutral-500 uppercase">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((a) => (
                      <tr key={a.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                        <td className="p-3 text-white font-medium">{a.user_name}</td>
                        <td className="p-3"><span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${a.type === "Check-in" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>{a.type}</span></td>
                        <td className="p-3 text-neutral-400 font-mono text-[11px]">{new Date(a.captured_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="p-3 text-neutral-500 text-[11px]">{a.location_name ?? "—"}</td>
                      </tr>
                    ))}
                    {attendance.length === 0 && <tr><td colSpan={4} className="text-center py-8 text-neutral-600 text-sm">Belum ada absensi tanggal ini.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
