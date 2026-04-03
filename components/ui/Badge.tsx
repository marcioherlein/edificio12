type Variant = "green" | "yellow" | "red" | "blue" | "gray";

interface Props {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}

const variantClass: Record<Variant, string> = {
  green: "bg-green-100 text-green-800",
  yellow: "bg-yellow-100 text-yellow-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  gray: "bg-gray-100 text-gray-700",
};

export default function Badge({ children, variant = "gray", className = "" }: Props) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variantClass[variant]} ${className}`}>
      {children}
    </span>
  );
}
