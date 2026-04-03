import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
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

  const { data: expenses } = await svc
    .from("expenses")
    .select("*")
    .order("date", { ascending: false });

  return <ExpensesClient expenses={expenses ?? []} isAdmin={isAdmin} />;
}
