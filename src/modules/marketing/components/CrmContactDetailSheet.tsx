import React, { useState } from 'react';
import { MessageCircle, Tag, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CrmContact,
  CrmStageKey,
  CrmInteractionLog,
  CrmStageDefinition,
} from '../types';
import { CrmContactXRayPanel } from '@/components/marketing/crm/CrmContactXRayPanel';

export interface CrmContactDetailSheetProps {
  contact: CrmContact | null;
  onClose: () => void;
  stages: CrmStageDefinition[];
  logs: CrmInteractionLog[];
  onStageChange?: (contactId: string, newStage: CrmStageKey) => Promise<void>;
  onAddNote?: (contactId: string, note: string) => Promise<void>;
  buildWhatsAppUrl: (contact: CrmContact) => string;
}

export const CrmContactDetailSheet: React.FC<CrmContactDetailSheetProps> = ({
  contact,
  onClose,
  stages,
  logs,
  onStageChange,
  onAddNote,
  buildWhatsAppUrl,
}) => {
  const [newNote, setNewNote] = useState('');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isUpdatingStage, setIsUpdatingStage] = useState(false);

  if (!contact) return null;

  const handleStageChange = async (newStage: CrmStageKey) => {
    if (!onStageChange) return;
    setIsUpdatingStage(true);
    try {
      await onStageChange(contact.id, newStage);
    } finally {
      setIsUpdatingStage(false);
    }
  };

  const handleNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !onAddNote) return;
    setIsSubmittingNote(true);
    try {
      await onAddNote(contact.id, newNote.trim());
      setNewNote('');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const contactLogs = logs.filter((l) => l.contactId === contact.id);

  return (
    <Sheet open={!!contact} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto overscroll-contain flex flex-col p-4 sm:p-6">
        <SheetHeader className="text-left space-y-1 pb-4 border-b">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border">
              <AvatarImage src={contact.avatarUrl} alt={contact.fullName} />
              <AvatarFallback className="text-sm font-bold bg-primary/10 text-primary">
                {contact.fullName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base sm:text-lg font-bold truncate">
                {contact.fullName}
              </SheetTitle>
              <SheetDescription className="text-xs truncate">
                {contact.phone} {contact.email ? `• ${contact.email}` : ''}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-4 py-4">
          {/* Seletor de Estágio do Funil */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase">
              Etapa Atual no Funil
            </label>
            <Select
              value={contact.stage}
              onValueChange={(val) => handleStageChange(val as CrmStageKey)}
              disabled={isUpdatingStage}
            >
              <SelectTrigger className="h-11 min-h-[44px] w-full text-xs">
                <SelectValue placeholder="Selecione o estágio" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.key} value={s.key} className="text-xs">
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Painel Raio-X Passivo com Gravador de Voz */}
          <CrmContactXRayPanel contact={contact} onAddNote={onAddNote} />

          {/* Variáveis de Template */}
          {Object.keys(contact.templateVariables || {}).length > 0 && (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                <Tag className="h-3.5 w-3.5" /> Variáveis de Template
              </span>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(contact.templateVariables).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-[10px] font-mono">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Botão Ação WhatsApp */}
          <a
            href={buildWhatsAppUrl(contact)}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-11 min-h-[44px] flex items-center justify-center gap-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            Abrir Conversa no WhatsApp
          </a>

          {/* Timeline de Interações */}
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase">
              Timeline de Interações
            </h4>
            <div className="space-y-2 max-h-36 overflow-y-auto overscroll-contain pr-1">
              {contactLogs.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  Nenhuma interação registrada ainda.
                </p>
              ) : (
                contactLogs.map((log) => (
                  <div key={log.id} className="text-xs p-2 rounded bg-muted/30 border space-y-0.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{log.authorName || 'Sistema'}</span>
                      <span>{new Date(log.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-foreground">{log.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Formulário Rápido de Nota */}
          {onAddNote && (
            <form onSubmit={handleNoteSubmit} className="space-y-2 pt-2 border-t">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Adicionar Anotação
              </label>
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ex: Contato pediu para retornar na sexta..."
                rows={2}
                className="text-xs"
              />
              <Button
                type="submit"
                disabled={isSubmittingNote || !newNote.trim()}
                className="w-full h-11 min-h-[44px] text-xs gap-1.5"
              >
                {isSubmittingNote ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Salvar Nota
              </Button>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};
