import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className = "", padding = true }: Props) {
  return (
    <div
      className={`bg-white border rounded-lg ${padding ? "p-5" : ""} ${className}`}
      style={{ borderColor: "var(--fiori-border)", boxShadow: "0 1px 3px rgba(0,0,0,0.10), 0 1px 2px rgba(0,0,0,0.06)" }}
    >
      {children}
    </div>
  );
}
