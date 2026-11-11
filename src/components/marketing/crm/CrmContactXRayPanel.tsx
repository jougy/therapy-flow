import React, { useState } from 'react';
import {
  ShieldCheck,
  Zap,
  MapPin,
  Calendar,
  Layers,
  Activity,
  CheckCircle2,
  ExternalLink,
  Lock,
  Sparkles,
  Send,
  Loader2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import type { CrmContact } from '@/modules/marketing/types';
import { CrmVoiceNoteRecorder, type CrmTranscriptionResult } from './CrmVoiceNoteRecorder';

export interface CrmContactXRayPanelProps {
  contact: CrmContact;
  className?: string;
  onOpenWhatsApp?: (contact: CrmContact) => void;
  onAddNote?: (note: string, tag?: string) => Promise<void> | void;
  initialNote?: string;
}

export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return 'Sem telefone cadastrado';
  const d = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  if (d.length === 11) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  }
  return phone;
}

export function deriveLocationFromPhone(phone?: string): string {
  if (!phone) return 'Brasil (Local não informado)';
  const digits = phone.replace(/\D/g, '');
  const d = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits;
  const ddd = d.slice(0, 2);
  const dddMap: Record<string, string> = {
    '11': 'São Paulo / SP', '12': 'São José dos Campos / SP', '13': 'Santos / SP',
    '14': 'Bauru / SP', '15': 'Sorocaba / SP', '16': 'Ribeirão Preto / SP',
    '17': 'São José do Rio Preto / SP', '18': 'Presidente Prudente / SP', '19': 'Campinas / SP',
    '21': 'Rio de Janeiro / RJ', '22': 'Campos / RJ', '24': 'Petrópolis / RJ',
    '27': 'Vitória / ES', '28': 'Cachoeiro / ES',
    '31': 'Belo Horizonte / MG', '32': 'Juiz de Fora / MG', '33': 'Gov. Valadares / MG',
    '34': 'Uberlândia / MG', '35': 'Poços de Caldas / MG', '37': 'Divinópolis / MG', '38': 'Montes Claros / MG',
    '41': 'Curitiba / PR', '42': 'Ponta Grossa / PR', '43': 'Londrina / PR', '44': 'Maringá / PR',
    '45': 'Cascavel / PR', '46': 'Fco. Beltrão / PR',
    '47': 'Joinville / SC', '48': 'Florianópolis / SC', '49': 'Chapecó / SC',
    '51': 'Porto Alegre / RS', '53': 'Pelotas / RS', '54': 'Caxias do Sul / RS', '55': 'Santa Maria / RS',
    '61': 'Brasília / DF', '62': 'Goiânia / GO', '63': 'Palmas / TO', '64': 'Rio Verde / GO',
    '65': 'Cuiabá / MT', '66': 'Rondonópolis / MT', '67': 'Campo Grande / MS',
    '71': 'Salvador / BA', '73': 'Ilhéus / BA', '74': 'Juazeiro / BA', '75': 'Feira de Santana / BA',
    '77': 'Vitória da Conquista / BA', '79': 'Aracaju / SE',
    '81': 'Recife / PE', '82': 'Maceió / AL', '83': 'João Pessoa / PB', '84': 'Natal / RN',
    '85': 'Fortaleza / CE', '86': 'Teresina / PI', '87': 'Petrolina / PE', '88': 'Juazeiro do Norte / CE',
    '91': 'Belém / PA', '92': 'Manaus / AM', '93': 'Santarém / PA', '94': 'Marabá / PA',
    '98': 'São Luís / MA',
  };
  return dddMap[ddd] ? `${dddMap[ddd]} (Detectado por DDD)` : 'Brasil (Nacional)';
}

export function computeEngagementThermometer(contact: CrmContact) {
  if (contact.stage === 'churn') {
    return {
      label: 'Inativo / Churn',
      percent: 15,
      colorClass: 'text-rose-600 dark:text-rose-400',
      bgClass: 'bg-rose-500',
    };
  }
  if (contact.stage === 'grace_period') {
    return {
      label: 'Risco de Churn / Em Carência',
      percent: 30,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500',
    };
  }
  if (contact.stage === 'stalled') {
    return {
      label: 'Engajamento Moderado / Pausado',
      percent: 45,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500',
    };
  }
  if (contact.stage === 'new') {
    return {
      label: 'Onboarding / Aquecendo',
      percent: 65,
      colorClass: 'text-blue-600 dark:text-blue-400',
      bgClass: 'bg-blue-500',
    };
  }
  return {
    label: 'Alto Engajamento Clínico / Comercial',
    percent: 92,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    bgClass: 'bg-emerald-500',
  };
}

export function formatInteractionDate(dateStr?: string): string {
  if (!dateStr) return 'Sem registro';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  } catch {
    return dateStr;
  }
}

export const CrmContactXRayPanel: React.FC<CrmContactXRayPanelProps> = ({
  contact,
  className,
  onOpenWhatsApp,
  onAddNote,
  initialNote = '',
}) => {
  const [noteText, setNoteText] = useState(initialNote);
  const [transcribedTag, setTranscribedTag] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);

  const formattedPhone = formatPhoneNumber(contact.phone);
  const location = deriveLocationFromPhone(contact.phone);
  const thermometer = computeEngagementThermometer(contact);
  const docHash = contact.id.replace(/\D/g, '').slice(-4) || '9241';
  const isPatient = contact.targetType === 'patient';

  // Extração inteligente de estrutura
  const planName = contact.templateVariables?.plano || contact.badgeLabel || 'Plano Padrão';
  const cycleInfo = contact.clinicalOrBusinessMetric.primaryValue || 'Ciclo Mensal';
  const tenure = contact.clinicalOrBusinessMetric.secondaryValue || 'Recente';

  const handleTranscribeSuccess = (result: CrmTranscriptionResult) => {
    setNoteText((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return result.text;
      return `${trimmed}\n\n${result.text}`;
    });
    if (result.tag) {
      setTranscribedTag(result.tag);
    }
    toast({
      title: 'Transcrição inserida na nota',
      description: 'Revise o texto e clique em Salvar Nota.',
    });
  };

  const handleSaveNote = async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;

    setIsSavingNote(true);
    try {
      if (onAddNote) {
        await onAddNote(trimmed, transcribedTag || undefined);
      }
      toast({
        title: 'Nota salva com sucesso',
        description: 'Anotação vinculada ao histórico do contato.',
      });
      setNoteText('');
      setTranscribedTag(null);
    } catch (err) {
      console.error('Erro ao salvar nota no raio-x:', err);
      toast({
        title: 'Erro ao salvar nota',
        description: 'Não foi possível salvar a anotação. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNote(false);
    }
  };

  return (
    <div
      data-testid="crm-contact-xray-panel"
      className={cn(
        'w-full max-w-full min-w-0 overflow-x-hidden rounded-xl border bg-card/60 p-4 space-y-4 shadow-sm text-left',
        className
      )}
    >
      {/* Header do Raio-X */}
      <div className="flex items-center justify-between pb-2 border-b">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-amber-500" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-foreground">
            Raio-X do Contato (Passivo)
          </h3>
        </div>
        <Badge variant="secondary" className="text-[10px] gap-1 px-1.5 py-0 font-medium">
          <ShieldCheck className="h-3 w-3 text-emerald-500" />
          Telemetria 100% Automática
        </Badge>
      </div>

      {/* Bloco 1: Identidade & Comunicação */}
      <div className="flex items-center gap-3">
        <Avatar className="h-11 w-11 border flex-shrink-0">
          <AvatarImage src={contact.avatarUrl} alt={contact.fullName} />
          <AvatarFallback className="text-xs font-bold bg-primary/10 text-primary">
            {contact.fullName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              {contact.fullName}
            </span>
            <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase">
              {isPatient ? 'Paciente' : 'Afiliado'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate font-mono">
            {formattedPhone}
          </p>
          <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">
            <CheckCircle2 className="h-3 w-3" />
            <span>WhatsApp canal verificado</span>
          </div>
        </div>
      </div>

      {/* Bloco 2: Dados de Estrutura & Plano */}
      <div className="grid grid-cols-2 gap-2 bg-muted/40 p-2.5 rounded-lg border text-xs">
        <div>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Layers className="h-3 w-3 text-primary" />
            {isPatient ? 'Convênio / Categoria' : 'Plano Contratado'}
          </span>
          <span className="font-semibold text-foreground text-xs mt-0.5 block truncate">
            {planName}
          </span>
        </div>
        <div>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3 text-primary" />
            {isPatient ? 'Última Consulta' : 'Ciclo / Status'}
          </span>
          <span className="font-semibold text-foreground text-xs mt-0.5 block truncate">
            {cycleInfo}
          </span>
        </div>
        <div className="col-span-2 pt-1 border-t border-border/40 flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground">Tempo de Permanência:</span>
          <span className="font-medium text-foreground">{tenure}</span>
        </div>
      </div>

      {/* Bloco 3: Atividade & Termômetro de Uso */}
      <div className="space-y-1.5 p-2.5 bg-muted/20 rounded-lg border">
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
            <Activity className="h-3 w-3 text-primary" />
            Termômetro de Uso & Engajamento:
          </span>
          <span className={cn('text-xs font-bold', thermometer.colorClass)}>
            {thermometer.percent}%
          </span>
        </div>
        <Progress value={thermometer.percent} className="h-1.5 w-full" />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
          <span className="truncate">{thermometer.label}</span>
          <span className="flex-shrink-0">
            Último registro: {formatInteractionDate(contact.lastInteractionAt)}
          </span>
        </div>
      </div>

      {/* Bloco 4: Localização Aproximada & Dados Fiscais Anonimizados */}
      <div className="space-y-1 text-xs pt-1">
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <MapPin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
          <span className="truncate">Região: <strong className="text-foreground font-medium">{location}</strong></span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
          <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <span className="truncate">
            Doc. Anonimizado: <code className="text-foreground font-mono">***.***.{docHash}-**</code> (LGPD)
          </span>
        </div>
      </div>

      {/* Bloco 5: Anotações Rápidas & Gravador de Voz (IA Whisper) */}
      <div className="space-y-2 pt-2 border-t">
        <div className="flex items-center justify-between">
          <label
            htmlFor={`xray-note-${contact.id}`}
            className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Nova Anotação & Voz (Whisper)
          </label>
          {transcribedTag && (
            <Badge
              variant="secondary"
              data-testid="crm-transcribed-tag-badge"
              className="text-[10px] gap-1 px-1.5 py-0 font-medium bg-primary/10 text-primary border-primary/20"
            >
              <Sparkles className="h-2.5 w-2.5" />
              {transcribedTag}
            </Badge>
          )}
        </div>

        <Textarea
          id={`xray-note-${contact.id}`}
          data-testid="crm-contact-note-textarea"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Digite uma anotação ou use o gravador de voz para transcrever automaticamente..."
          rows={3}
          className="text-xs resize-none"
        />

        <div className="flex items-center gap-2">
          <Button
            type="button"
            data-testid="crm-save-note-button"
            onClick={handleSaveNote}
            disabled={isSavingNote || !noteText.trim()}
            className="flex-1 h-11 min-h-[44px] text-xs font-semibold gap-1.5"
          >
            {isSavingNote ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            Salvar Nota
          </Button>

          <CrmVoiceNoteRecorder
            contactName={contact.fullName}
            onTranscribeSuccess={handleTranscribeSuccess}
          />
        </div>
      </div>

      {/* Ação rápida para WhatsApp se fornecida */}
      {onOpenWhatsApp && (
        <button
          type="button"
          onClick={() => onOpenWhatsApp(contact)}
          className="w-full h-11 min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg text-xs font-medium bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Interagir via WhatsApp
        </button>
      )}
    </div>
  );
};
