import type { Metadata } from "next";
import { SignInClient } from "@/components/auth/sign-in-client";
import { googleAuthUrl } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in — CollabGrid",
};

export default function LoginPage() {
  return <SignInClient googleAuthUrl={googleAuthUrl()} />;
}
