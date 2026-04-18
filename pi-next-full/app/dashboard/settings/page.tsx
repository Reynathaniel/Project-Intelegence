"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/components/auth/user-provider";
import { Settings, Building2, Users, Shield, Loader2, CheckCircle2, Copy, ExternalLink, Zap } from "lucide-react";

export default function SettingsPage() {
  const { user, profile, orgs, currentOrgId } = useUser();
  const supabase = createClient();
  const [org, setOrg] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!currentOrgId) return;
    (async () => {
      const [orgRes, memRes] = await Promise.all([
        supabase.from("organizations").select("*").eq("id", currentOrgId).single(),
        supabase.from("organization_members").select("id, user_id, role, joined_at, profiles(email, full_name, avatar_url)").eq("org_id", currentOrgId),
      ]);
      setOrg(orgRes.data); setMembers(memRes.data ?? []);
      setOrgName(orgRes.data?.name ?? ""); setLoading(false);
    })();
  }, [currentOrgId]);

  const handleSaveOrg = async () => {
    if (!currentOrgId || !orgName.trim()) return;
    setSaving(true);
    await supabase.from("organizations").update({ name: orgName.trim() }).eq("id", currentOrgId);
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };

  const currentMembership = orgs.find((o) => o.org_id === currentOrgId);
  const isAdmin = currentMembership?.role === "owner" || currentMembership?.role === "admin";

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 pi-spinner" /></div>;

  return (
    <div className="p-6 lg:p-8 max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-neutral-400" /> Settings
        </h1>
        <p className="text-neutral-500 text-sm mt-1">Organization & account configuration</p>
      </div>

      {/* Profile */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" /> Your Profile
        </h2>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> :
              <div className="w-full h-full flex items-center justify-center text-xl font-bold text-neutral-600">{profile?.full_name?.[0] ?? "?"}</div>}
          </div>
          <div>
            <p className="text-white font-bold">{profile?.full_name}</p>
            <p className="text-neutral-500 text-sm">{profile?.email}</p>
            <p className="text-[10px] text-neutral-600 font-mono mt-1">ID: {user?.id?.slice(0, 8)}...</p>
          </div>
        </div>
      </section>

      {/* Organization */}
      {org && (
        <section className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-500" /> Organization
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Org Name</label>
              <input type="text" value={orgName} onChange={(e) => setOrgName(e.target.value)} disabled={!isAdmin}
                className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-xl text-white text-sm disabled:opacity-50 focus:outline-none focus:border-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Slug</label>
              <div className="px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-neutral-500 text-sm font-mono">{org.slug}</div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Plan</label>
              <div className="px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-sm">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${org.plan === "trial" ? "bg-amber-500/10 text-amber-400" : org.plan === "pro" ? "bg-emerald-500/10 text-emerald-400" : "bg-blue-500/10 text-blue-400"}`}>{org.plan}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                <Zap className="w-3 h-3" /> AI Quota
              </label>
              <div className="px-3 py-2.5 bg-neutral-800/50 border border-neutral-700/50 rounded-xl text-sm text-neutral-300">
                {org.monthly_extract_used} / {org.monthly_extract_limit}
                <div className="w-full h-1.5 bg-neutral-700 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${Math.min(100, (org.monthly_extract_used / org.monthly_extract_limit) * 100)}%` }} />
                </div>
              </div>
            </div>
          </div>
          {isAdmin && (
            <button onClick={handleSaveOrg} disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 disabled:opacity-50 transition-colors text-sm cursor-pointer">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : null}
              {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
            </button>
          )}
        </section>
      )}

      {/* Members */}
      <section className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-neutral-800">
          <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <Users className="w-4 h-4 text-pink-500" /> Members ({members.length})
          </h2>
        </div>
        <div className="divide-y divide-neutral-800/50">
          {members.map((m) => {
            const p = m.profiles as any;
            return (
              <div key={m.id} className="flex items-center gap-3 px-6 py-3">
                <div className="w-8 h-8 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden shrink-0">
                  {p?.avatar_url ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> :
                    <div className="w-full h-full flex items-center justify-center text-xs font-bold text-neutral-600">{p?.full_name?.[0]}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium truncate">{p?.full_name ?? "Unknown"}</p>
                  <p className="text-[10px] text-neutral-500 truncate">{p?.email}</p>
                </div>
                <span className={`text-[9px] font-bold uppercase px-2 py-1 rounded-full ${
                  m.role === "owner" ? "bg-amber-500/10 text-amber-400" : m.role === "admin" ? "bg-blue-500/10 text-blue-400" : "bg-neutral-800 text-neutral-500"
                }`}>{m.role}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Supabase Info */}
      <section className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-widest mb-3">System Info</h2>
        <div className="space-y-2 text-[11px] font-mono text-neutral-500">
          <p>Supabase Project: lrcosayrtssjchdbjwiz</p>
          <p>Region: ap-southeast-1 (Singapore)</p>
          <p>Database: PostgreSQL 17</p>
          <p>π Version: 2.0.0-beta</p>
        </div>
      </section>
    </div>
  );
}
