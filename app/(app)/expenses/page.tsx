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

  const [expensesRes, categoriesRes] = await Promise.all([
    svc.from("expenses").select("id, description, amount, date, category, method, receipt_url").order("date", { ascending: false }),
    svc.from("expense_categories").select("id, name").order("name"),
  ]);

  return (
    <ExpensesClient
      expenses={expensesRes.data ?? []}
      categories={categoriesRes.data ?? []}
      isAdmin={isAdmin}
    />
  );
}
