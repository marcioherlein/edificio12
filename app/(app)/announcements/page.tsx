import { createClient, createServiceClient } from "@/lib/supabase/server";
import AnnouncementsClient from "./AnnouncementsClient";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    isAdmin = profile?.role === "admin";
  }

  const svc = createServiceClient();
  const { data: announcements } = await svc
    .from("announcements")
    .select("*")
    .order("date", { ascending: false });

  return <AnnouncementsClient announcements={announcements ?? []} isAdmin={isAdmin} />;
}
