import React from "react";
import { formatLastSeenAt } from "@/lib/subaccounts";
import type { ActiveSessionRow } from "../types";

export interface CapacityOverviewCardsProps {
  membersCount: number;
  activeSessions: ActiveSessionRow[];
  concurrentCapacity: {
    limit: number;
    occupied: number;
    available: number;
    reached: boolean;
  };
  isAccountOwner: boolean;
}

export const CapacityOverviewCards: React.FC<CapacityOverviewCardsProps> = ({
  membersCount,
  activeSessions,
  concurrentCapacity,
  isAccountOwner,
}) => {
  return (
    <div className="space-y-4">
      {/* Banner de Capacidade da Clínica */}
      <div className="rounded-lg border p-4 text-sm bg-muted/10">
        <p className="font-semibold text-foreground">Capacidade Operacional da Clínica</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Equipe Cadastrada: {membersCount} colaborador(es) (sem limite de cadastro) | Acessos Simultâneos:{" "}
          {activeSessions.length} de {concurrentCapacity.limit} acesso(s) em uso.
        </p>
      </div>

      {/* 4 Cards de Capacidade */}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Colaboradores na Equipe
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">{membersCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Acessos Simultâneos Ativos
          </p>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {activeSessions.length} / {concurrentCapacity.limit}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Acessos Disponíveis Agora
          </p>
          <p className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {concurrentCapacity.available}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Conta Principal
          </p>
          <p className="mt-2 text-sm font-medium text-foreground">
            {isAccountOwner ? "Você (Proprietário)" : "Outro usuário"}
          </p>
        </div>
      </div>

      {/* Acessos Ativos Neste Momento */}
      <div className="rounded-xl border p-4 space-y-3 bg-card shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm text-foreground">Acessos ativos neste momento</p>
            <p className="text-xs text-muted-foreground">
              No plano Clínica, sua equipe tem cadastro ilimitado e capacidade de até{" "}
              {concurrentCapacity.limit} acesso(s) simultâneo(s) conectados ao mesmo tempo.
            </p>
          </div>
        </div>

        {activeSessions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum acesso ativo identificado agora.</p>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((session) => (
              <div
                key={session.session_key}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 text-xs bg-background"
              >
                <div>
                  <p className="font-semibold text-foreground">
                    {session.full_name || session.email || session.user_id}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {session.device_label ||
                      [session.browser, session.platform].filter(Boolean).join(" • ") ||
                      "Dispositivo sem identificação"}
                  </p>
                </div>
                <span className="text-muted-foreground">
                  Visto por último: {formatLastSeenAt(session.last_seen_at ?? null)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
