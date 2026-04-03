import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AnnouncementsClient from "./AnnouncementsClient";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const svc = createServiceClient();

  const { data: announcements } = await svc
    .from("announcements")
    .select("*")
    .order("date", { ascending: false });

  return <AnnouncementsClient announcements={announcements ?? []} isAdmin={isAdmin} />;
}
