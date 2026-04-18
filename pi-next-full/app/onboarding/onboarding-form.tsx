"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Building2 } from "lucide-react";

export function OnboardingForm({ userEmail }: { userEmail: string }) {
  const [orgName, setOrgName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 63);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgName.trim() || !slug.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const finalSlug = slug.length < 3 ? slug + "-org" : slug;

      const { data, error: insertErr } = await supabase
        .from("organizations")
        .insert({
          name: orgName.trim(),
          slug: finalSlug,
        })
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.message.includes("slug")) {
          setError("Slug sudah dipakai. Coba nama lain.");
        } else {
          setError(insertErr.message);
        }
        return;
      }

      // Trigger trg_org_add_owner otomatis add user sebagai owner
      // Redirect ke dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Gagal membuat organisasi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
          Nama Organisasi / Perusahaan
        </label>
        <input
          type="text"
          value={orgName}
          onChange={(e) => {
            setOrgName(e.target.value);
            setSlug(generateSlug(e.target.value));
          }}
          placeholder="PT Mega Konstruksi"
          className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm"
          required
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
          Slug (untuk URL)
        </label>
        <div className="flex items-center gap-0">
          <span className="px-3 py-3 bg-neutral-900 border border-r-0 border-neutral-700 rounded-l-xl text-xs text-neutral-500 font-mono">
            pi.app/
          </span>
          <input
            type="text"
            value={slug}
            onChange={(e) =>
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
                  .slice(0, 63)
              )
            }
            placeholder="mega-konstruksi"
            className="flex-1 px-3 py-3 bg-neutral-800 border border-neutral-700 rounded-r-xl text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500 transition-colors text-sm font-mono"
            required
            minLength={3}
          />
        </div>
      </div>

      <div className="p-3 bg-neutral-800/50 border border-neutral-700/50 rounded-xl">
        <p className="text-[11px] text-neutral-500">
          <span className="text-neutral-400 font-semibold">Admin:</span>{" "}
          {userEmail} (Anda otomatis menjadi owner)
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !orgName.trim() || slug.length < 3}
        className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-emerald-500 text-black font-bold rounded-xl hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Building2 className="w-5 h-5" />
        )}
        {loading ? "Membuat..." : "Buat Organisasi"}
      </button>
    </form>
  );
}
