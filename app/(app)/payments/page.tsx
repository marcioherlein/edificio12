import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { formatCurrency, formatDate, currentMonth } from "@/lib/utils";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import PaymentsClient from "./PaymentsClient";

export default async function PaymentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, unit_id")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";
  const svc = createServiceClient();

  const [paymentsRes, unitsRes] = await Promise.all([
    isAdmin
      ? svc.from("payments").select("*, units(name)").order("created_at", { ascending: false }).limit(100)
      : svc.from("payments").select("*, units(name)").eq("unit_id", profile?.unit_id ?? "").order("created_at", { ascending: false }),
    isAdmin ? svc.from("units").select("id, name").order("name") : Promise.resolve({ data: [] }),
  ]);

  return (
    <PaymentsClient
      payments={paymentsRes.data ?? []}
      units={(unitsRes as any).data ?? []}
      isAdmin={isAdmin}
    />
  );
}
