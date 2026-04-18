"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

interface OrgMembership {
  org_id: string;
  role: "owner" | "admin" | "member";
  org_name: string;
  org_slug: string;
}

interface UserCtx {
  user: User | null;
  profile: Profile | null;
  orgs: OrgMembership[];
  currentOrgId: string | null;
  setCurrentOrgId: (id: string) => void;
  loading: boolean;
}

const Ctx = createContext<UserCtx>({
  user: null,
  profile: null,
  orgs: [],
  currentOrgId: null,
  setCurrentOrgId: () => {},
  loading: true,
});

export function useUser() {
  return useContext(Ctx);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }
      setUser(user);

      // Profile
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, email, full_name, avatar_url")
        .eq("id", user.id)
        .single();
      setProfile(prof);

      // Orgs
      const { data: memberships } = await supabase
        .from("organization_members")
        .select("org_id, role, organizations(name, slug)")
        .eq("user_id", user.id);

      const mapped: OrgMembership[] = (memberships ?? []).map((m: any) => ({
        org_id: m.org_id,
        role: m.role,
        org_name: m.organizations?.name ?? "",
        org_slug: m.organizations?.slug ?? "",
      }));
      setOrgs(mapped);

      // Restore or pick first org
      const stored = typeof window !== "undefined"
        ? localStorage.getItem("pi_current_org")
        : null;
      if (stored && mapped.some((o) => o.org_id === stored)) {
        setCurrentOrgId(stored);
      } else if (mapped.length > 0) {
        setCurrentOrgId(mapped[0].org_id);
      }

      setLoading(false);
    }
    load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setProfile(null);
        setOrgs([]);
        setCurrentOrgId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  function handleSetOrg(id: string) {
    setCurrentOrgId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("pi_current_org", id);
    }
  }

  return (
    <Ctx.Provider
      value={{
        user,
        profile,
        orgs,
        currentOrgId,
        setCurrentOrgId: handleSetOrg,
        loading,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
