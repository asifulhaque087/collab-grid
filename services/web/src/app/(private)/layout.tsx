import { redirect } from "next/navigation";
import { headers } from "next/headers";

// Shared shell for the auth pages. Server component so it can bounce already
// authenticated visitors straight to the dashboard before any form renders.
// Reuses the `.home-page` scope for the dotted-grid backdrop and logo styling.
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  const headerList = await headers();
  const authorization = headerList.get("authorization") ?? "";
  if (!authorization) redirect("/sign-in");

  return <main>{children}</main>;
}
