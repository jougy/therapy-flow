import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { callRpc, getErrorMessage } from "@/components/platform/platform-api";
import {
  ALL_TRUE_PLATFORM_FEATURE_FLAGS,
  EMPTY_PLATFORM_FEATURE_FLAGS,
  LEGACY_MARKETING_PLATFORM_FLAGS,
  PLATFORM_FEATURE_FLAG_DEFINITIONS,
  PLATFORM_FEATURE_FLAG_KEYS,
} from "@/lib/platform-feature-flags";

interface PersonBackofficeAccessTabProps {
  userId: string;
  userName: string;
  userEmail?: string;
}

function buildInitialFlagsMap(rawFlags: unknown, role: string | null): Record<string, boolean> {
  if (role === "platform_owner") {
    return { ...ALL_TRUE_PLATFORM_FEATURE_FLAGS };
  }

  if (rawFlags && typeof rawFlags === "object" && !Array.isArray(rawFlags)) {
    const entries = Object.entries(rawFlags as Record<string, unknown>);
    if (entries.length > 0) {
      return Object.fromEntries(
        PLATFORM_FEATURE_FLAG_KEYS.map((key) => [key, Boolean((rawFlags as Record<string, unknown>)[key])])
      );
    }
  }

  if (role === "platform_marketing") {
    return { ...EMPTY_PLATFORM_FEATURE_FLAGS, ...LEGACY_MARKETING_PLATFORM_FLAGS };
  }

  return { ...EMPTY_PLATFORM_FEATURE_FLAGS };
}

export function PersonBackofficeAccessTab({
  userId,
  userName,
  userEmail,
}: PersonBackofficeAccessTabProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [initialHasAccess, setInitialHasAccess] = useState(false);
  const [existingRole, setExistingRole] = useState<string | null>(null);
  const [flags, setFlags] = useState<Record<string, boolean>>({ ...EMPTY_PLATFORM_FEATURE_FLAGS });

  const loadAccess = useCallback(async () => {
    setLoading(true);
    try {
      const builder = supabase.from("platform_admins").select("user_id, role, is_active, feature_flags" as never);
      const eqBuilder = builder?.eq?.("user_id", userId);
      const result =
        eqBuilder && typeof eqBuilder.maybeSingle === "function"
          ? ((await eqBuilder.maybeSingle()) as unknown as {
              data: { role?: string; is_active?: boolean; feature_flags?: unknown } | null;
              error: { message?: string } | null;
            })
          : { data: null, error: null };

      let row = result.data;
      if (result.error) {
        const fallback = await supabase
          .from("platform_admins")
          .select("user_id, role, is_active")
          .eq("user_id", userId)
          .maybeSingle();
        row = fallback.data as { role?: string; is_active?: boolean; feature_flags?: unknown } | null;
      }

      if (row && row.is_active !== false) {
        const role = row.role ?? "platform_marketing";
        setHasAccess(true);
        setInitialHasAccess(true);
        setExistingRole(role);
        setFlags(buildInitialFlagsMap(row.feature_flags, role));
      } else {
        setHasAccess(false);
        setInitialHasAccess(false);
        setExistingRole(row?.role ?? null);
        setFlags({ ...EMPTY_PLATFORM_FEATURE_FLAGS });
      }
    } catch {
      setHasAccess(false);
      setInitialHasAccess(false);
      setExistingRole(null);
      setFlags({ ...EMPTY_PLATFORM_FEATURE_FLAGS });
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const handleToggleAccess = (nextChecked: boolean) => {
    setHasAccess(nextChecked);
    if (nextChecked && existingRole === "platform_owner") {
      setFlags({ ...ALL_TRUE_PLATFORM_FEATURE_FLAGS });
    }
  };

  const handleToggleFlag = (key: string, nextChecked: boolean) => {
    setFlags((prev) => ({
      ...prev,
      [key]: nextChecked,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payloadFlags = hasAccess
        ? Object.fromEntries(PLATFORM_FEATURE_FLAG_KEYS.map((key) => [key, Boolean(flags[key])]))
        : {};

      const { error } = await callRpc("upsert_platform_admin_access", {
        _target_user_id: userId,
        _has_access: hasAccess,
        _feature_flags: payloadFlags,
      });

      if (error) {
        throw error;
      }

      setInitialHasAccess(hasAccess);
      toast({
        title: hasAccess ? "Acesso ao Backoffice atualizado" : "Acesso ao Backoffice revogado",
        description: hasAccess
          ? `Permissões de ${userName} salvas com sucesso.`
          : `${userName} não possui mais acesso ao Backoffice.`,
      });
    } catch (error) {
      toast({
        title: "Erro ao salvar acesso ao Backoffice",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-full min-w-0">
        <CardContent className="flex min-h-[180px] items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-4">
      <Card className="w-full max-w-full min-w-0">
        <CardHeader className="space-y-1">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
              <CardTitle className="text-base sm:text-lg truncate">Acesso ao Backoffice</CardTitle>
            </div>
            {existingRole && (
              <Badge variant="outline" className="w-fit shrink-0">
                {existingRole}
              </Badge>
            )}
          </div>
          <CardDescription>
            Controle granular de acesso administrativo e feature flags para{" "}
            <span className="font-medium text-foreground">{userEmail || userName}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex min-h-[44px] flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5 min-w-0">
              <Label htmlFor="backoffice-access-switch" className="text-sm font-semibold cursor-pointer">
                Este usuário terá acesso ao backoffice?
              </Label>
              <p className="text-xs text-muted-foreground">
                Ative para liberar o painel administrativo e definir exatamente quais módulos e ferramentas estarão disponíveis.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {initialHasAccess && !hasAccess && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={saving}
                  onClick={() => void handleSave()}
                  className="gap-1.5 min-h-[40px]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Confirmar revogação
                </Button>
              )}
              <Switch
                id="backoffice-access-switch"
                aria-label="Este usuário terá acesso ao backoffice?"
                checked={hasAccess}
                onCheckedChange={handleToggleAccess}
                disabled={saving}
              />
            </div>
          </div>

          {hasAccess && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Feature Flags do Backoffice
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Selecione os módulos, rotas e ferramentas administrativas habilitados para esta conta.
                  </p>
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {PLATFORM_FEATURE_FLAG_KEYS.filter((key) => flags[key]).length} de {PLATFORM_FEATURE_FLAG_KEYS.length} ativas
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {PLATFORM_FEATURE_FLAG_DEFINITIONS.map((flagDef) => {
                  const switchId = `backoffice-flag-${flagDef.key}`;
                  const checked = Boolean(flags[flagDef.key]);
                  return (
                    <div
                      key={flagDef.key}
                      className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border bg-card p-3.5 transition-colors hover:border-primary/40"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Label htmlFor={switchId} className="text-sm font-medium cursor-pointer">
                            {flagDef.label}
                          </Label>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                            {flagDef.key}
                          </code>
                        </div>
                        <p className="text-xs text-muted-foreground">{flagDef.description}</p>
                      </div>
                      <Switch
                        id={switchId}
                        aria-label={`${flagDef.label} (${flagDef.key})`}
                        checked={checked}
                        onCheckedChange={(val) => handleToggleFlag(flagDef.key, val)}
                        disabled={saving || existingRole === "platform_owner"}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="w-full sm:w-auto gap-2 min-h-[44px]"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Salvar permissões do backoffice
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
