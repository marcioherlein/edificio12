import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DocumentsClient from "./DocumentsClient";

export default async function DocumentsPage() {
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

  const { data: documents } = await svc
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  return <DocumentsClient documents={documents ?? []} isAdmin={isAdmin} />;
}
