"use client";

import { useEffect, useState } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { CredentialsModal } from "@/components/auth/credentials-modal";

export function SignInClient({ googleAuthUrl }: { googleAuthUrl: string }) {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setModalOpen(true), 1000);
    return () => clearTimeout(timer);
  }, []);
  const [credentialPreset, setCredentialPreset] = useState<{
    email: string;
    password: string;
  } | null>(null);

  return (
    <>
      <LoginForm googleAuthUrl={googleAuthUrl} credentialPreset={credentialPreset} />
      <CredentialsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onFillCredentials={(email, password) => {
          setCredentialPreset({ email, password });
          setModalOpen(false);
        }}
      />
    </>
  );
}
