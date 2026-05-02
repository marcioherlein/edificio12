"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Inicio",  icon: "🏠" },
  { href: "/resumen",   label: "Resumen", icon: "📋" },
  { href: "/documents", label: "Docs",    icon: "📄" },
];

export default function BottomNav({ role }: { role: string }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 shadow-[0_-2px_8px_rgba(0,0,0,0.15)] md:hidden"
      style={{ background: "var(--fiori-shell)", borderTop: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-0.5 text-xs transition-colors ${
                active ? "text-white" : "text-white/45 hover:text-white/80"
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className={`font-semibold text-[11px] ${active ? "text-white" : ""}`}>{label}</span>
              {active && <span className="absolute bottom-0 w-8 h-0.5 bg-white rounded-t" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
