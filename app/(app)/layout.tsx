import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/resident/BottomNav";
import Link from "next/link";
import DesktopNav from "@/components/resident/DesktopNav";

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
      {/* Shell Bar */}
      <header
        className="flex-shrink-0 px-4 h-14 flex items-center justify-between shadow-md z-50 sticky top-0"
        style={{ background: "var(--fiori-shell)" }}
      >
        {/* Left: logo + app title */}
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-2.5 mr-2">
            <img
              src="/logo.png"
              alt="Edificio 12"
              className="w-8 h-8 rounded-full object-cover"
            />
            <span className="font-semibold text-white text-sm tracking-wide">Edificio 12</span>
          </Link>

          {/* Desktop nav links — hidden on mobile */}
          <DesktopNav />
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
              <span className="text-xs text-white/80 hidden sm:block truncate max-w-[140px]">{name}</span>
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

      {/* Page content — no bottom padding on desktop since nav is in header */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        {children}
      </main>

      {/* Bottom navigation — mobile only (md:hidden is set inside the component) */}
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
