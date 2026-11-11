import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  MessageCircle,
  Clock,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type {
  MarketingCrmAdapter,
  CrmContact,
  CrmStageKey,
  CrmInteractionLog,
} from '../types';
import { CrmContactDetailSheet } from './CrmContactDetailSheet';
import { CrmZeroInboxWidget } from '@/components/marketing/crm/CrmZeroInboxWidget';

export interface MarketingCrmEngineProps {
  adapter: MarketingCrmAdapter;
  className?: string;
  initialLogs?: CrmInteractionLog[];
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
}

function sanitizePhoneForWhatsApp(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 11 && !digits.startsWith('55')) {
    return `55${digits}`;
  }
  return digits;
}

function buildWhatsAppUrl(contact: CrmContact): string {
  const phone = sanitizePhoneForWhatsApp(contact.phone);
  const firstName = contact.fullName.trim().split(' ')[0] || 'Cliente';
  const customGreeting = contact.templateVariables?.first_name
    ? `Olá ${contact.templateVariables.first_name}, tudo bem?`
    : `Olá ${firstName}, tudo bem?`;

  const msg = contact.targetType === 'patient'
    ? `${customGreeting} Aqui é da equipe clínica Pluri-Health. Como você está hoje?`
    : `${customGreeting} Aqui é da equipe de parcerias da Pluri-Health. Gostaria de alinhar seus resultados!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
}

export const MarketingCrmEngine: React.FC<MarketingCrmEngineProps> = ({
  adapter,
  className,
  initialLogs = [],
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
}) => {
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = useCallback(
    (query: string) => {
      if (onSearchQueryChange) {
        onSearchQueryChange(query);
      } else {
        setInternalSearchQuery(query);
      }
    },
    [onSearchQueryChange]
  );
  const [activeStageFilter, setActiveStageFilter] = useState<CrmStageKey | 'all'>('all');
  const [selectedContact, setSelectedContact] = useState<CrmContact | null>(null);
  const [logs, setLogs] = useState<CrmInteractionLog[]>(initialLogs);

  // Filtragem de contatos
  const filteredContacts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return adapter.contacts.filter((c) => {
      const matchSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.email && c.email.toLowerCase().includes(q));

      const matchStage =
        activeStageFilter === 'all' || c.stage === activeStageFilter;

      return matchSearch && matchStage;
    });
  }, [adapter.contacts, searchQuery, activeStageFilter]);

  // Contagem por estágio
  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { all: adapter.contacts.length };
    adapter.stages.forEach((s) => {
      counts[s.key] = adapter.contacts.filter((c) => c.stage === s.key).length;
    });
    return counts;
  }, [adapter.contacts, adapter.stages]);

  const handleOpenContact = (contact: CrmContact) => {
    setSelectedContact(contact);
    adapter.onContactSelect?.(contact);
  };

  const handleStageChange = async (contactId: string, newStage: CrmStageKey) => {
    if (!adapter.onStageChange) return;
    await adapter.onStageChange(contactId, newStage);
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        contactId,
        actionType: 'stage_change',
        content: `Estágio alterado para: ${adapter.stages.find((s) => s.key === newStage)?.label || newStage}`,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
    if (selectedContact && selectedContact.id === contactId) {
      setSelectedContact({ ...selectedContact, stage: newStage });
    }
  };

  const handleAddNote = async (contactId: string, note: string) => {
    if (!adapter.onAddNote) return;
    await adapter.onAddNote(contactId, note);
    setLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        contactId,
        actionType: 'note',
        content: note,
        createdAt: new Date().toISOString(),
        authorName: 'Você',
      },
      ...prev,
    ]);
  };

  return (
    <div className={cn('w-full max-w-full min-w-0 overflow-x-hidden space-y-4', className)}>
      {/* Header Mobile-First Adaptativo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate">
              {adapter.title}
            </h2>
            <Badge variant="outline" className="text-xs uppercase font-mono">
              {adapter.targetType === 'patient' ? 'Pacientes' : 'Afiliados'}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-1">
            {adapter.subtitle}
          </p>
        </div>

        {/* Campo de Busca Rápida */}
        <div className="relative w-full sm:w-72 max-w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome ou fone..."
            className="pl-9 pr-4 h-11 text-sm bg-background w-full"
          />
        </div>
      </div>

      {/* Widget de Produtividade Zero-Inbox */}
      <CrmZeroInboxWidget
        contacts={adapter.contacts}
        onContactSelect={handleOpenContact}
      />

      {/* Filtro Rápido de Pílulas com Scroll Horizontal */}
      <div className="w-full max-w-full min-w-0 overflow-x-auto touch-pan-x pb-1">
        <div className="flex items-center gap-1.5 min-w-max">
          <Button
            type="button"
            size="sm"
            variant={activeStageFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setActiveStageFilter('all')}
            className="h-11 min-h-[44px] px-3.5 text-xs rounded-full"
          >
            Todos ({stageCounts.all || 0})
          </Button>
          {adapter.stages.map((stage) => {
            const count = stageCounts[stage.key] || 0;
            const isSelected = activeStageFilter === stage.key;
            return (
              <Button
                key={stage.key}
                type="button"
                size="sm"
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => setActiveStageFilter(stage.key)}
                className="h-11 min-h-[44px] px-3.5 text-xs rounded-full gap-1.5"
              >
                <span className={cn('h-2 w-2 rounded-full', stage.colorClass.split(' ')[0])} />
                <span>{stage.label}</span>
                <span className="opacity-70 font-mono text-[10px]">({count})</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Loading State */}
      {adapter.isLoading && (
        <div className="w-full flex items-center justify-center p-8 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando contatos do CRM...</span>
        </div>
      )}

      {/* Kanban Board com Scroll Horizontal Suave */}
      {!adapter.isLoading && (
        <div className="w-full max-w-full min-w-0 overflow-x-auto touch-pan-x pb-4">
          <div className="flex gap-3.5 min-w-max items-start">
            {adapter.stages.map((stage) => {
              const stageContacts = filteredContacts.filter((c) => c.stage === stage.key);

              return (
                <div
                  key={stage.key}
                  className="w-72 sm:w-80 max-w-full flex-shrink-0 bg-muted/30 border rounded-xl p-3 flex flex-col gap-3"
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn('h-2.5 w-2.5 rounded-full', stage.colorClass.split(' ')[0])} />
                      <span className="font-semibold text-xs uppercase tracking-wider text-foreground">
                        {stage.label}
                      </span>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {stageContacts.length}
                    </Badge>
                  </div>

                  {/* Contact Cards */}
                  <div className="flex flex-col gap-2.5 min-h-[120px]">
                    {stageContacts.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-28 border border-dashed rounded-lg p-2 text-center text-xs text-muted-foreground">
                        Nenhum contato nesta etapa
                      </div>
                    ) : (
                      stageContacts.map((contact) => (
                        <div
                          key={contact.id}
                          onClick={() => handleOpenContact(contact)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleOpenContact(contact)}
                          className="bg-card p-3 rounded-lg border shadow-sm hover:border-primary/50 transition-all text-left flex flex-col gap-2.5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-[44px]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarImage src={contact.avatarUrl} alt={contact.fullName} />
                                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                  {contact.fullName.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">
                                  {contact.fullName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {contact.phone}
                                </p>
                              </div>
                            </div>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                              {contact.badgeLabel}
                            </Badge>
                          </div>

                          {/* Métricas Clínicas ou Comerciais */}
                          <div className="grid grid-cols-2 gap-1.5 bg-muted/40 p-2 rounded text-[11px]">
                            <div>
                              <span className="text-muted-foreground block text-[10px]">
                                {contact.clinicalOrBusinessMetric.primaryLabel}
                              </span>
                              <span className="font-medium text-foreground">
                                {contact.clinicalOrBusinessMetric.primaryValue}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[10px]">
                                {contact.clinicalOrBusinessMetric.secondaryLabel}
                              </span>
                              <span className="font-medium text-foreground">
                                {contact.clinicalOrBusinessMetric.secondaryValue}
                              </span>
                            </div>
                          </div>

                          {/* Ações Rápidas do Card */}
                          <div className="flex items-center justify-between pt-1 gap-2">
                            <span className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {contact.lastInteractionAt || 'Sem contato'}
                            </span>

                            <a
                              href={buildWhatsAppUrl(contact)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="h-11 min-h-[44px] min-w-[44px] px-3 inline-flex items-center justify-center gap-1.5 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                              title="Conversar no WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                              <span className="text-[11px]">WhatsApp</span>
                            </a>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Drawer 360° para Detalhes do Contato Selecionado */}
      <CrmContactDetailSheet
        contact={selectedContact}
        onClose={() => setSelectedContact(null)}
        stages={adapter.stages}
        logs={logs}
        onStageChange={adapter.onStageChange ? (id, stage) => handleStageChange(id, stage) : undefined}
        onAddNote={adapter.onAddNote ? (id, note) => handleAddNote(id, note) : undefined}
        buildWhatsAppUrl={buildWhatsAppUrl}
      />
    </div>
  );
};
