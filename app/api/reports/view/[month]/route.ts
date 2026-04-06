import { createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ month: string }> }
) {
  const { month } = await params;

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return new NextResponse("Mes inválido.", { status: 400 });
  }

  const svc = createServiceClient();
  const { data } = await svc
    .from("monthly_reports")
    .select("report_html")
    .eq("month", month)
    .single();

  if (!data?.report_html) {
    return new NextResponse("Reporte no encontrado.", { status: 404 });
  }

  return new NextResponse(data.report_html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
