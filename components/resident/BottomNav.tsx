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
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 shadow-lg">
      <div className="flex">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-xs transition-colors ${
                active ? "text-blue-600" : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-lg leading-none">{icon}</span>
              <span className={`font-medium ${active ? "text-blue-600" : ""}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
