import { useState } from "react";
import { Plus, ShieldCheck, FileSpreadsheet, Building2, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface ClinicHealthInsuranceItem {
  id: string;
  name: string;
  ans_code: string | null;
  payment_term_days: number;
  is_active: boolean;
}

export const ClinicHealthInsurancesCard = () => {
  const { clinic, can } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [ansCode, setAnsCode] = useState("");
  const [paymentTermDays, setPaymentTermDays] = useState("30");

  const canManage = can("treasury.manage");

  const { data: insurances = [], isLoading } = useQuery({
    queryKey: ["clinic-health-insurances", clinic?.id],
    queryFn: async () => {
      if (!clinic?.id) return [];
      const { data, error } = await supabase
        .from("clinic_health_insurances")
        .select("id, name, ans_code, payment_term_days, is_active")
        .eq("clinic_id", clinic.id)
        .is("deleted_at", null)
        .order("name", { ascending: true });

      if (error) {
        // Se a tabela ainda não tiver sido migrada no banco de produção/teste remoto, retorna mock amigável
        return [];
      }
      return (data || []) as ClinicHealthInsuranceItem[];
    },
    enabled: Boolean(clinic?.id),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!clinic?.id) throw new Error("Clínica não encontrada");
      const { error } = await supabase.from("clinic_health_insurances").insert({
        clinic_id: clinic.id,
        name: name.trim(),
        ans_code: ansCode.trim() || null,
        payment_term_days: Math.max(0, parseInt(paymentTermDays, 10) || 30),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clinic-health-insurances", clinic?.id] });
      setDialogOpen(false);
      setName("");
      setAnsCode("");
      setPaymentTermDays("30");
      toast({
        title: "Convênio cadastrado",
        description: "A operadora parceira já está disponível para atendimentos.",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao cadastrar convênio",
        description: err.message || "Não foi possível registrar a operadora.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clinic_health_insurances")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clinic-health-insurances", clinic?.id] });
      toast({
        title: "Convênio removido",
        description: "O convênio foi inativado com sucesso.",
      });
    },
  });

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-primary" />
            Convênios & Operadoras Parceiras
          </CardTitle>
          <CardDescription className="text-xs">
            Gerencie os planos de saúde aceitos na clínica e prazos médios contratuais de faturamento.
          </CardDescription>
        </div>

        {canManage && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 self-start sm:self-auto">
                <Plus className="h-4 w-4" />
                Novo Convênio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Adicionar Convênio Parceiro</DialogTitle>
                <DialogDescription className="text-xs">
                  Cadastre o plano de saúde para vincular a pacotes e faturamentos.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="insurance-name">Nome da Operadora / Convênio *</Label>
                    <span className="text-[10px] text-muted-foreground">{name.length}/80</span>
                  </div>
                  <Input
                    id="insurance-name"
                    placeholder="Ex: Unimed Regional, SulAmérica, Bradesco..."
                    maxLength={80}
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 80))}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <Label htmlFor="insurance-ans">Registro ANS (Opcional)</Label>
                      <span className="text-[10px] text-muted-foreground">{ansCode.length}/6</span>
                    </div>
                    <Input
                      id="insurance-ans"
                      placeholder="Ex: 345678"
                      maxLength={6}
                      inputMode="numeric"
                      value={ansCode}
                      onChange={(e) => setAnsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="insurance-term">Prazo de Repasse (Dias)</Label>
                    <Input
                      id="insurance-term"
                      type="number"
                      min={0}
                      max={365}
                      value={paymentTermDays}
                      onChange={(e) => {
                        const val = parseInt(e.target.value.replace(/\D/g, ""), 10);
                        setPaymentTermDays(isNaN(val) ? "" : String(Math.min(365, Math.max(0, val))));
                      }}
                    />
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button
                  disabled={!name.trim() || createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? "Salvando..." : "Salvar Convênio"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Carregando convênios...</div>
        ) : insurances.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
            Nenhum convênio credenciado ainda. Se a sua clínica trabalha apenas via reembolso particular, não é necessário cadastrar operadoras aqui.
          </div>
        ) : (
          <div className="divide-y rounded-lg border">
            {insurances.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 text-sm transition hover:bg-muted/40"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{item.name}</span>
                    {item.ans_code && (
                      <Badge variant="outline" className="text-[10px]">
                        ANS {item.ans_code}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Repasse estimado em <strong>D+{item.payment_term_days}</strong> dias após fechamento.
                  </p>
                </div>

                {canManage && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(item.id)}
                    aria-label={`Excluir convênio ${item.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
