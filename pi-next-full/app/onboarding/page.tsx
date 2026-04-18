import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Check if already has an org
  const { data: memberships } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (memberships && memberships.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex items-center justify-center min-h-dvh bg-neutral-950 px-4">
      <div className="w-full max-w-md">
        <div className="p-8 border border-neutral-800 bg-neutral-900/60 backdrop-blur-xl rounded-3xl shadow-2xl space-y-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex items-center justify-center mx-auto">
              <span className="text-4xl font-bold text-emerald-500 select-none">π</span>
            </div>
            <h1 className="text-xl font-bold text-white">Setup Organisasi</h1>
            <p className="text-neutral-400 text-sm">
              Buat organisasi pertama Anda untuk mulai menggunakan Project Intelligence.
            </p>
          </div>

          <OnboardingForm userEmail={user.email ?? ""} />
        </div>
      </div>
    </div>
  );
}
