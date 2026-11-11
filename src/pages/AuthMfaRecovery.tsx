import { MfaRecoveryView } from "@/components/auth/MfaRecoveryView";

const AuthMfaRecovery = () => {
  return (
    <MfaRecoveryView
      title="Recuperação de Acesso (2FA)"
      description="Receba um código de verificação via WhatsApp ou E-mail para restabelecer o seu autenticador Ente Auth."
      onSuccessRedirect="/auth"
      backRedirect="/auth"
    />
  );
};

export default AuthMfaRecovery;
