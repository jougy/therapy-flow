import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Award, BarChart3, GitFork, Layers, Users } from "lucide-react";
import { AffiliatesOverviewTab } from "./affiliates/AffiliatesOverviewTab";
import { AffiliatesCrmTab } from "./affiliates/AffiliatesCrmTab";
import { TierEditorTab } from "./affiliates/TierEditorTab";
import { QuickInvitePartnerDialog } from "./affiliates/QuickInvitePartnerDialog";
import { PlatformAffiliateManagementModal } from "@/components/platform/PlatformAffiliateManagementModal";
import {
  PlatformInviteAffiliateModal,
  type PlatformInviteAffiliateUser,
} from "@/components/platform/PlatformInviteAffiliateModal";

// Importação dinâmica graciosa do painel de estatísticas
const AffiliatesStatsTab = React.lazy(() =>
  import("./affiliates/AffiliatesStatsTab")
    .then((m) => ({ default: m.AffiliatesStatsTab || m.default }))
    .catch(() => ({
      default: () => (
        <div data-testid="affiliates-stats-tab" className="p-8 text-center text-muted-foreground text-sm">
          Painel de estatísticas analíticas em carregamento...
        </div>
      ),
    }))
);

export const PlatformAffiliatesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [managementModalOpen, setManagementModalOpen] = useState(false);
  const [selectedAffiliateId, setSelectedAffiliateId] = useState<string | null>(null);

  const [promptInviteOpen, setPromptInviteOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteUser, setInviteUser] = useState<PlatformInviteAffiliateUser | null>(null);

  const handleOpenManagement = (affiliateId?: string | null) => {
    setSelectedAffiliateId(affiliateId || null);
    setManagementModalOpen(true);
  };

  const handleOpenInviteFlow = () => {
    setPromptInviteOpen(true);
  };

  const handleProceedWithUser = (user: PlatformInviteAffiliateUser) => {
    setInviteUser(user);
    setInviteModalOpen(true);
  };

  return (
    <div
      data-testid="platform-affiliates-page"
      className="w-full max-w-full min-w-0 overflow-x-hidden space-y-6 pb-12"
    >
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full max-w-full min-w-0 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2">
              <Award className="h-6 w-6 text-amber-500 shrink-0" />
              Afiliados & Parceiros
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Gestão global do programa de afiliados, tiers, comissões e parcerias estratégicas.
            </p>
          </div>

          <TabsList className="grid grid-cols-2 sm:grid-cols-4 w-full sm:w-auto h-auto sm:h-10 p-1">
            <TabsTrigger
              value="overview"
              className="gap-2 text-xs sm:text-sm min-h-[36px]"
              data-testid="tab-overview"
            >
              <Users className="h-4 w-4" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger
              value="stats"
              className="gap-2 text-xs sm:text-sm min-h-[36px]"
              data-testid="tab-stats"
            >
              <BarChart3 className="h-4 w-4" />
              Estatísticas & Desempenho
            </TabsTrigger>
            <TabsTrigger
              value="crm"
              className="gap-2 text-xs sm:text-sm min-h-[36px]"
              data-testid="tab-crm"
            >
              <GitFork className="h-4 w-4" />
              CRM & Relações
            </TabsTrigger>
            <TabsTrigger
              value="tiers"
              className="gap-2 text-xs sm:text-sm min-h-[36px]"
              data-testid="tab-tiers"
            >
              <Layers className="h-4 w-4" />
              Editor de Tiers
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="m-0 focus-visible:outline-none">
          <AffiliatesOverviewTab
            onOpenManagement={handleOpenManagement}
            onOpenInvite={handleOpenInviteFlow}
          />
        </TabsContent>

        <TabsContent value="stats" className="m-0 focus-visible:outline-none">
          <React.Suspense
            fallback={
              <div
                data-testid="affiliates-stats-loading"
                className="p-8 text-center text-muted-foreground text-sm"
              >
                Carregando estatísticas...
              </div>
            }
          >
            <AffiliatesStatsTab />
          </React.Suspense>
        </TabsContent>

        <TabsContent value="crm" className="m-0 focus-visible:outline-none">
          <AffiliatesCrmTab />
        </TabsContent>

        <TabsContent value="tiers" className="m-0 focus-visible:outline-none">
          <TierEditorTab />
        </TabsContent>
      </Tabs>

      {/* Modal Master de Gestão Soberana de Afiliados */}
      <PlatformAffiliateManagementModal
        affiliateId={selectedAffiliateId}
        isOpen={managementModalOpen}
        onClose={() => {
          setManagementModalOpen(false);
          setSelectedAffiliateId(null);
        }}
      />

      {/* Diálogo de Pré-preenchimento para convite avulso */}
      <QuickInvitePartnerDialog
        isOpen={promptInviteOpen}
        onClose={() => setPromptInviteOpen(false)}
        onProceed={handleProceedWithUser}
      />

      {/* Modal Master Oficial de Convite de Afiliado */}
      <PlatformInviteAffiliateModal
        user={inviteUser}
        isOpen={inviteModalOpen}
        onClose={() => {
          setInviteModalOpen(false);
          setInviteUser(null);
        }}
      />
    </div>
  );
};

export default PlatformAffiliatesPage;
