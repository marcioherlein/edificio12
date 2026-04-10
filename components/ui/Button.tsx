import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

const variantClass: Record<string, string> = {
  primary:   "bg-[#3b82f6] text-white hover:bg-[#2563eb] disabled:opacity-50 border border-[#3b82f6]",
  secondary: "bg-white text-[#3b82f6] border border-[#3b82f6] hover:bg-[#eff6ff] disabled:opacity-50",
  danger:    "bg-[#dc2626] text-white hover:bg-[#b91c1c] disabled:opacity-50 border border-[#dc2626]",
  ghost:     "bg-transparent text-[#0f172a] hover:bg-[#f1f5f9] disabled:opacity-50 border border-transparent",
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
      className={`inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:ring-offset-1 cursor-pointer ${variantClass[variant]} ${sizeClass[size]} ${className}`}
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
