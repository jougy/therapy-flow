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
        <div className="flex items-center justify-between">
          <Label htmlFor="login-password">Sua senha de acesso</Label>
          <Link to="/auth" className="text-xs text-primary hover:underline font-medium">
            Esqueci minha senha
          </Link>
        </div>
        <div className="relative">
          <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={passwordInputRef}
            id="login-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Digite sua senha"
            required
            className="pl-9 pr-10"
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <Button
        type="submit"
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 gap-2 h-11 text-base font-semibold"
        disabled={submitting || !password}
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
        Entrar e aceitar convite
      </Button>

      <div className="pt-1 text-center">
        <button
          type="button"
          className="text-xs text-primary hover:underline font-medium"
          onClick={onSwitchToSignup}
        >
          Ainda não possui senha? Completar meu cadastro
        </button>
      </div>
    </form>
  );
};
