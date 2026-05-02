interface Props {
  label: string;
  value: string;
  sub?: string;
  color?: "blue" | "green" | "amber" | "slate";
}

const colorMap = {
  blue:  { accent: "#3b82f6", bg: "#eff6ff", text: "#1d4ed8" },
  green: { accent: "#16a34a", bg: "#f0fdf4", text: "#15803d" },
  amber: { accent: "#d97706", bg: "#fffbeb", text: "#b45309" },
  slate: { accent: "#64748b", bg: "#f8fafc", text: "#475569" },
};

export default function KPIStatCard({ label, value, sub, color = "slate" }: Props) {
  const { accent, bg, text } = colorMap[color];
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-1 border"
      style={{ background: "#fff", borderColor: "#e2e8f0", borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#64748b" }}>
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums leading-tight" style={{ color: text }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs font-medium" style={{ color: "#94a3b8" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
