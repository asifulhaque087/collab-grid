import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { googleAuthUrl } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Create account — CollabGrid",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  return <RegisterForm googleAuthUrl={googleAuthUrl()} plan={plan} />;
}
