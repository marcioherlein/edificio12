"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio" },
  { href: "/resumen",   label: "Resumen" },
  { href: "/documents", label: "Docs" },
];

export default function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1 h-14" aria-label="Navegación principal">
      {NAV_ITEMS.map(({ href, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="relative flex items-center px-3 h-full text-sm font-medium transition-colors"
            style={{
              color: active ? "#ffffff" : "rgba(255,255,255,0.6)",
            }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.6)"; }}
          >
            {label}
            {active && (
              <span
                className="absolute bottom-0 left-3 right-3 h-0.5 rounded-t"
                style={{ background: "#ffffff" }}
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
