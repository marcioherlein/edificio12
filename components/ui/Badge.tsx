type Variant = "green" | "yellow" | "red" | "blue" | "gray";

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClass: Record<Variant, string> = {
  green:  "bg-[#f0fdf4] text-[#16a34a] border border-[#16a34a]/30",
  yellow: "bg-[#fffbeb] text-[#d97706] border border-[#d97706]/30",
  red:    "bg-[#fef2f2] text-[#dc2626] border border-[#dc2626]/30",
  blue:   "bg-[#eff6ff] text-[#3b82f6] border border-[#3b82f6]/30",
  gray:   "bg-[#f1f5f9] text-[#64748b] border border-[#e2e8f0]",
};

export default function Badge({ children, variant = "gray", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold ${variantClass[variant]} ${className}`}>
      {children}
    </span>
  );
}
