import { createClient, createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ReportViewer from "./ReportViewer";

interface Props {
  params: Promise<{ month: string }>;
}

export default async function ReportPage({ params }: Props) {
  const { month } = await params;
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

  const { data: report } = await svc
    .from("monthly_reports")
    .select("report_html, summary, generated_at")
    .eq("month", month)
    .single();

  return (
    <ReportViewer
      month={month}
      reportHtml={report?.report_html ?? null}
      summary={report?.summary ?? null}
      generatedAt={report?.generated_at ?? null}
      isAdmin={isAdmin}
    />
  );
}
