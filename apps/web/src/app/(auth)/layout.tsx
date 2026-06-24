import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/home/logo-mark";
import { getCurrentUser } from "@/lib/auth";

// Shared shell for the auth pages. Server component so it can bounce already
// authenticated visitors straight to the dashboard before any form renders.
// Reuses the `.home-page` scope for the dotted-grid backdrop and logo styling.
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="home-page flex min-h-screen flex-col">
      <header className="relative z-[1] px-6 py-5">
        <Link href="/" className="logo" style={{ fontSize: 18 }}>
          <LogoMark />
          CollabGrid
        </Link>
      </header>
      <main className="relative z-[1] flex flex-1 items-center justify-center px-6 pb-16">
        {children}
      </main>
    </div>
  );
}
