import type { Metadata } from "next";
import { SignInClient } from "@/components/auth/sign-in-client";
import { googleAuthUrl } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in — LootBoard",
};

export default function LoginPage() {
  return <SignInClient googleAuthUrl={googleAuthUrl()} />;
}
