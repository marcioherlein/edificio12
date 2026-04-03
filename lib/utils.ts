export type PaymentStatus = "PAGADO" | "PARCIAL" | "PENDIENTE";

export function getPaymentStatus(
  paidAmount: number,
  feeAmount: number
): PaymentStatus {
  if (paidAmount >= feeAmount) return "PAGADO";
  if (paidAmount > 0) return "PARCIAL";
  return "PENDIENTE";
}

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "2026-04"
}

export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return date.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return new Date(Number(y), Number(m) - 1, Number(d)).toLocaleDateString(
    "es-AR",
    { day: "2-digit", month: "2-digit", year: "numeric" }
  );
}
