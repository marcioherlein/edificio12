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
    <div className="flex flex-col min-h-screen bg-gray-950">
      {/* Top bar */}
      <header className="flex-shrink-0 bg-gray-900 border-b border-gray-800 px-4 h-14 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm10-10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"/>
            </svg>
          </div>
          <span className="font-semibold text-white text-sm">Edificio 12</span>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <span className="text-xs text-gray-400 hidden sm:block">{name}</span>
              {isAdmin && (
                <span className="text-xs bg-blue-900/60 text-blue-300 px-2 py-0.5 rounded-full font-medium border border-blue-800">
                  Admin
                </span>
              )}
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 px-4 py-1.5 rounded-xl transition-colors"
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
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded"
      >
        Salir
      </button>
    </form>
  );
}
