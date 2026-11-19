import { useEffect, useState } from "react";
import { MfaRecoveryView } from "@/components/auth/MfaRecoveryView";
import { SimulationDebugPanel } from "@/components/SimulationDebugPanel";

const PlatformMfaRecovery = () => {
  const [debugModalOpen, setDebugModalOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isKeyD = e.key === "D" || e.key === "d";
      const isMacCmdCtrl = e.metaKey && e.ctrlKey && isKeyD;
      const isCtrlAlt = e.ctrlKey && e.altKey && isKeyD;
      if (isMacCmdCtrl || isCtrlAlt) {
        e.preventDefault();
        e.stopPropagation();
        setDebugModalOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <MfaRecoveryView
        title="Recuperação Master (2FA)"
        description="Receba um código de segurança via WhatsApp ou E-mail para redefinir seu Ente Auth do painel administrativo."
        onSuccessRedirect="/platform/mfa"
        backRedirect="/platform/mfa"
      />
      <SimulationDebugPanel open={debugModalOpen} onOpenChange={setDebugModalOpen} />
    </>
  );
};

export default PlatformMfaRecovery;
