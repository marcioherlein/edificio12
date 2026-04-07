type Variant = "green" | "yellow" | "red" | "blue" | "gray";

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClass: Record<Variant, string> = {
  green:  "bg-[#f1fdf6] text-[#107e3e] border border-[#107e3e]/30",
  yellow: "bg-[#fef6ec] text-[#e9730c] border border-[#e9730c]/30",
  red:    "bg-[#fdf2f2] text-[#bb0000] border border-[#bb0000]/30",
  blue:   "bg-[#e8f2ff] text-[#0070f2] border border-[#0070f2]/30",
  gray:   "bg-[#f2f2f2] text-[#6a6d70] border border-[#e5e5e5]",
};

export default function Badge({ children, variant = "gray", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold ${variantClass[variant]} ${className}`}>
      {children}
    </span>
  );
}
