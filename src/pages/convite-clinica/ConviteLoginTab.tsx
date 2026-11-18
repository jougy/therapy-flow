import { Eye, EyeOff, Loader2, LockKeyhole, LogIn, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ConviteLoginTabProps {
  email: string;
  password: string;
  setPassword: (value: string) => void;
  showPassword: boolean;
  setShowPassword: (value: boolean) => void;
  submitting: boolean;
  passwordInputRef: React.RefObject<HTMLInputElement>;
  onSubmit: (e: React.FormEvent) => void;
  onSwitchToSignup: () => void;
}

export const ConviteLoginTab = ({
  email,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  submitting,
  passwordInputRef,
  onSubmit,
  onSwitchToSignup,
}: ConviteLoginTabProps) => {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="space-y-2">
        <Label>E-mail convidado</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={email} readOnly className="pl-9 bg-muted/50 cursor-not-allowed" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="login-password">Sua senha de acesso</Label>
          <Link to="/auth" className="inline-flex min-h-[44px] items-center px-1 text-xs text-primary hover:underline font-medium">
            Esqueci minha senha
          </Link>
        </div>
        <div className="flex items-center rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          <div className="relative flex-1 min-w-0">
            <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              ref={passwordInputRef}
              id="login-password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha"
              required
              className="h-11 border-0 bg-transparent pl-9 pr-2 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <button
            type="button"
            className="h-11 w-11 min-h-[44px] min-w-[44px] shrink-0 flex items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Ocultar senha" : "Ver senha"}
            title={showPassword ? "Ocultar senha" : "Ver senha"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
        disabled={submitting || !password}
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : <LogIn className="h-5 w-5" aria-hidden="true" />}
        Entrar e aceitar convite
      </Button>

      <div className="pt-1 text-center">
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center justify-center px-2 text-xs text-primary hover:underline font-medium"
          onClick={onSwitchToSignup}
        >
          Ainda não possui senha? Completar meu cadastro
        </button>
      </div>
    </form>
  );
};
