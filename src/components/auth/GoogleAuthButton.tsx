import { useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

interface GoogleAuthButtonProps {
  mode?: "signin" | "signup";
  className?: string;
  redirectTo?: string;
  disabled?: boolean;
}

export const GoogleIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    width="24"
    height="24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g transform="matrix(1, 0, 0, 1, 0, 0)">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </g>
  </svg>
);

export const GoogleAuthButton = ({
  mode = "signin",
  className = "",
  redirectTo,
  disabled = false,
}: GoogleAuthButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handleGoogleAuth = async () => {
    try {
      setLoading(true);
      const targetRedirect =
        redirectTo ||
        (typeof window !== "undefined"
          ? `${window.location.origin}/espacopessoal`
          : undefined);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: targetRedirect,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (error) {
        toast({
          title: "Erro ao conectar com Google",
          description: error.message,
          variant: "destructive",
        });
        setLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao iniciar autenticação com o Google.";
      toast({
        title: "Erro inesperado",
        description: msg,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const label = mode === "signup" ? "Cadastrar com o Google" : "Continuar com o Google";

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleGoogleAuth}
      disabled={disabled || loading}
      className={`w-full h-11 border-border/80 bg-background hover:bg-accent/60 text-foreground font-medium flex items-center justify-center gap-2.5 transition-all shadow-sm ${className}`}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : (
        <GoogleIcon className="w-4 h-4 shrink-0" />
      )}
      <span>{label}</span>
    </Button>
  );
};
