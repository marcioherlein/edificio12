import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PublicHomePage() {
  // If the user is already logged in, send them straight to the app
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ background: "var(--fiori-page-bg)" }}>

      {/* Shell-style header bar */}
      <div
        className="fixed top-0 left-0 right-0 h-12 flex items-center px-5 shadow-md z-50"
        style={{ background: "var(--fiori-shell)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded flex items-center justify-center bg-white/20">
            <svg viewBox="0 0 24 24" fill="white" className="w-4 h-4">
              <path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm10-10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"/>
            </svg>
          </div>
          <span className="font-semibold text-white text-sm tracking-wide">Edificio 12</span>
        </div>
      </div>

      {/* Hero card */}
      <div className="w-full max-w-sm mt-16">
        <div className="bg-white rounded border p-8 text-center shadow-sm"
          style={{ borderColor: "var(--fiori-border)" }}>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded mb-5"
            style={{ background: "var(--fiori-shell)" }}>
            <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7">
              <path d="M10 3H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1zm10-10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1zm0 10h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1z"/>
            </svg>
          </div>

          <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--fiori-text)" }}>Edificio 12</h1>
          <p className="text-sm mb-6" style={{ color: "var(--fiori-text-muted)" }}>
            Portal de administración de expensas
          </p>

          <Link
            href="/login"
            className="block w-full py-2.5 text-sm font-semibold text-white rounded text-center transition-colors"
            style={{ background: "var(--fiori-blue)" }}
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
