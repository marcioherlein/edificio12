import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/resident/BottomNav";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let role: string | null = null;
  let name: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("name, role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? "resident";
    name = profile?.name ?? user.email ?? null;
  }

  const isAdmin = role === "admin";

  return (
    <div className="flex flex-col min-h-screen" style={{ background: "var(--fiori-page-bg)" }}>
      {/* Fiori Shell Bar */}
      <header
        className="flex-shrink-0 px-4 h-12 flex items-center justify-between shadow-md z-50"
        style={{ background: "var(--fiori-shell)" }}
      >
        {/* Left: logo + app title */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded flex items-center justify-center bg-white/20">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm10-10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"/>
            </svg>
          </div>
          <span className="font-semibold text-white text-sm tracking-wide">Edificio 12</span>
        </div>

        {/* Right: user info + logout */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              {isAdmin && (
                <span className="text-[11px] font-semibold text-white/70 border border-white/30 px-2 py-0.5 rounded uppercase tracking-wide hidden sm:inline">
                  Admin
                </span>
              )}
              <span className="text-xs text-white/80 hidden sm:block">{name}</span>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="text-xs font-semibold text-white border border-white/40 hover:bg-white/10 px-3 py-1.5 rounded transition-colors"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </header>

      {/* Page content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom navigation */}
      <BottomNav role={role ?? "guest"} />
    </div>
  );
}

function LogoutButton() {
  return (
    <form action="/api/logout" method="post">
      <button
        type="submit"
        className="text-xs text-white/60 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
      >
        Salir
      </button>
    </form>
  );
}
