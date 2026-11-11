import React, { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Award, ChevronRight, Search, Shield, User } from "lucide-react";
import { getAffiliateTierDefinition } from "@/lib/affiliate-tiers";
import type { AffiliateRecord } from "./types";

export interface AffiliateSelectionListProps {
  affiliates: AffiliateRecord[];
  loading: boolean;
  onSelect: (affiliateId: string) => void;
}

export const AffiliateSelectionList: React.FC<AffiliateSelectionListProps> = ({
  affiliates,
  loading,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredAffiliates = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return affiliates;
    return affiliates.filter((item) => {
      const matchCoupon = item.coupon_code?.toLowerCase().includes(q);
      const matchSlug = item.referral_slug?.toLowerCase().includes(q);
      const matchName = item.profile?.full_name?.toLowerCase().includes(q);
      const matchEmail = item.profile?.email?.toLowerCase().includes(q);
      return matchCoupon || matchSlug || matchName || matchEmail;
    });
  }, [affiliates, searchTerm]);

  return (
    <div className="space-y-3 w-full max-w-full min-w-0">
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          type="search"
          placeholder="Buscar parceiro por cupom, nome ou e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 text-xs sm:text-sm min-h-[40px]"
        />
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted-foreground">
          Carregando lista de parceiros...
        </div>
      ) : filteredAffiliates.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted-foreground border rounded-lg bg-muted/20">
          {searchTerm
            ? "Nenhum parceiro encontrado para os termos da busca."
            : "Nenhum afiliado cadastrado até o momento."}
        </div>
      ) : (
        <div className="space-y-2 max-h-[50vh] overflow-y-auto overscroll-contain pr-1">
          {filteredAffiliates.map((item) => {
            const tierDef = getAffiliateTierDefinition(item.tier || "bronze");
            const fullName = item.profile?.full_name || "Sem nome cadastrado";
            const email = item.profile?.email;

            return (
              <div
                key={item.id}
                className="p-3 rounded-lg border bg-card hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left"
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate text-foreground">{fullName}</p>
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                        {item.coupon_code}
                      </Badge>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${tierDef.badgeColorClass}`}>
                        {tierDef.label}
                      </span>
                      {item.status !== "active" && (
                        <Badge
                          variant="destructive"
                          className="text-[10px] uppercase px-1.5 py-0"
                        >
                          {item.status}
                        </Badge>
                      )}
                    </div>
                    {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground">{item.active_referrals_count ?? 0}</span> indicados ativos • Alíquota:{" "}
                      <span className="font-medium text-foreground">{item.first_month_commission_percent ?? 30}% / {item.recurring_commission_percent ?? 10}%</span>
                    </p>
                  </div>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="sm:self-center shrink-0 h-8 gap-1 text-xs"
                  onClick={() => onSelect(item.id)}
                >
                  Gerenciar
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
