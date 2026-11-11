import { MfaRecoveryView } from "@/components/auth/MfaRecoveryView";

const PlatformMfaRecovery = () => {
  return (
    <MfaRecoveryView
      title="Recuperação Master (2FA)"
      description="Receba um código de segurança via WhatsApp ou E-mail para redefinir seu Ente Auth do painel administrativo."
      onSuccessRedirect="/platform/mfa"
      backRedirect="/platform/mfa"
    />
  );
};

export default PlatformMfaRecovery;
