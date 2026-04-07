import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClass: Record<string, string> = {
  primary:   "bg-[#0070f2] text-white hover:bg-[#0064d9] disabled:opacity-50 border border-[#0070f2]",
  secondary: "bg-white text-[#0070f2] border border-[#0070f2] hover:bg-[#e8f2ff] disabled:opacity-50",
  danger:    "bg-[#bb0000] text-white hover:bg-[#a30000] disabled:opacity-50 border border-[#bb0000]",
  ghost:     "bg-transparent text-[#32363a] hover:bg-[#f2f2f2] disabled:opacity-50 border border-transparent",
};

const sizeClass: Record<string, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  children,
  disabled,
  className = "",
  ...props
}: Props) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#0070f2] focus:ring-offset-1 cursor-pointer ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      )}
      {children}
    </button>
  );
}
