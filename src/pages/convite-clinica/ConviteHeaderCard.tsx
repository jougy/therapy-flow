import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InviteSummary } from "./types";

interface ConviteHeaderCardProps {
  invite: InviteSummary;
  roleLabel: string;
}

export const ConviteHeaderCard = ({ invite, roleLabel }: ConviteHeaderCardProps) => {
  return (
    <>
      <div className="h-1.5 bg-gradient-to-r from-sky-500 via-teal-400 to-emerald-400" />
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-sky-100 shadow-sm">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-foreground">{invite.clinic_name}</CardTitle>
              <CardDescription className="text-sm text-sky-800 font-medium">{invite.email}</CardDescription>
            </div>
          </div>
          <Badge className="w-fit bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200">
            {roleLabel}
          </Badge>
        </div>
      </CardHeader>
    </>
  );
};

export const ConviteJobDetails = ({ invite }: { invite: InviteSummary }) => {
  if (!invite.job_title && !invite.specialty) return null;
  return (
    <div className="grid gap-2 rounded-xl border border-sky-100 bg-sky-50/60 p-3.5 text-sm sm:grid-cols-2">
      {invite.job_title && (
        <div>
          <p className="text-xs font-medium text-sky-900/70">Cargo pré-definido</p>
          <p className="font-semibold text-sky-950">{invite.job_title}</p>
        </div>
      )}
      {invite.specialty && (
        <div>
          <p className="text-xs font-medium text-sky-900/70">Especialidade</p>
          <p className="font-semibold text-sky-950">{invite.specialty}</p>
        </div>
      )}
    </div>
  );
};
