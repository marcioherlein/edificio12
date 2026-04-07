import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className = "", padding = true }: Props) {
  return (
    <div
      className={`bg-white border rounded ${padding ? "p-5" : ""} ${className}`}
      style={{ borderColor: "var(--fiori-border)", boxShadow: "0 0 4px rgba(0,0,0,0.08)" }}
    >
      {children}
    </div>
  );
}
