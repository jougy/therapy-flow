import React from "react";
import type { AnamnesisField, AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

export interface PrintBlankKitSheetProps {
  clinicName?: string;
  clinicLogoUrl?: string | null;
  includeHeader?: boolean;
  includePatientRegistration?: boolean;
  includeUniversalBase?: boolean;
  universalBaseSchema?: AnamnesisTemplateSchema | null;
  selectedTemplateName?: string | null;
  selectedTemplateSchema?: AnamnesisTemplateSchema | null;
}

export const PrintBlankKitSheet: React.FC<PrintBlankKitSheetProps> = ({
  clinicName = "Clínica de Saúde",
  clinicLogoUrl,
  includeHeader = true,
  includePatientRegistration = true,
  includeUniversalBase = true,
  universalBaseSchema = [],
  selectedTemplateName,
  selectedTemplateSchema = [],
}) => {
  const currentDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const renderPrintableField = (field: AnamnesisField) => {
    switch (field.type) {
      case "section":
      case "horizontal_section":
        return (
          <div key={field.id} className="col-span-full pt-4 pb-1 border-b-2 border-slate-800 mb-2">
            <h3 className="text-base font-bold uppercase tracking-wide text-slate-900">{field.label}</h3>
            {field.helpText && <p className="text-xs text-slate-500 italic mt-0.5">{field.helpText}</p>}
          </div>
        );

      case "short_text":
        return (
          <div key={field.id} className="col-span-1 border border-slate-300 rounded p-2 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.helpText && <p className="text-[10px] text-slate-500 mb-1">{field.helpText}</p>}
            <div className="h-6 border-b border-dotted border-slate-400 mt-2" />
          </div>
        );

      case "long_text":
        return (
          <div key={field.id} className="col-span-full border border-slate-300 rounded p-2.5 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.helpText && <p className="text-[10px] text-slate-500 mb-1">{field.helpText}</p>}
            <div className="space-y-4 pt-1 pb-1">
              <div className="border-b border-dashed border-slate-300 h-5" />
              <div className="border-b border-dashed border-slate-300 h-5" />
              <div className="border-b border-dashed border-slate-300 h-5" />
              <div className="border-b border-dashed border-slate-300 h-5" />
            </div>
          </div>
        );

      case "date":
        return (
          <div key={field.id} className="col-span-1 border border-slate-300 rounded p-2 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="text-xs text-slate-400 pt-2 tracking-widest font-mono">
              [ &nbsp; &nbsp; ] / [ &nbsp; &nbsp; ] / [ &nbsp; &nbsp; &nbsp; &nbsp; ]
            </div>
          </div>
        );

      case "number":
        return (
          <div key={field.id} className="col-span-1 border border-slate-300 rounded p-2 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="h-6 border-b border-dotted border-slate-400 mt-1" />
          </div>
        );

      case "checklist":
      case "multiple_choice":
      case "select":
      case "section_selector":
        return (
          <div key={field.id} className="col-span-full border border-slate-300 rounded p-2.5 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            {field.helpText && <p className="text-[10px] text-slate-500 mb-1">{field.helpText}</p>}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
              {field.options && field.options.length > 0 ? (
                field.options.map((opt) => (
                  <div key={opt.id} className="flex items-center gap-2 text-xs text-slate-800">
                    <span className="w-4 h-4 border border-slate-500 rounded-sm inline-block shrink-0" />
                    <span>{opt.label}</span>
                  </div>
                ))
              ) : (
                <div className="col-span-full flex gap-4 text-xs text-slate-600">
                  <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 rounded-sm" /> Sim</div>
                  <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 rounded-sm" /> Não</div>
                  <div className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border border-slate-500 rounded-sm" /> Parcial</div>
                </div>
              )}
            </div>
          </div>
        );

      case "slider":
        return (
          <div key={field.id} className="col-span-full border border-slate-300 rounded p-2.5 bg-white">
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              <span className="text-xs font-mono text-slate-500">Escala: {field.min ?? 0} a {field.max ?? 10}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-slate-600 border-t border-b border-slate-200 py-1.5 my-1">
              <span>{field.min ?? 0}</span>
              <div className="flex-1 border-b border-dashed border-slate-400 mx-3" />
              <span>{field.max ?? 10}</span>
            </div>
            <div className="text-[10px] text-slate-400 text-right">Valor anotado: [ &nbsp; &nbsp; &nbsp; ]</div>
          </div>
        );

      case "address_block":
        return (
          <div key={field.id} className="col-span-full border border-slate-300 rounded p-2.5 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="border border-slate-300 rounded p-1.5"><span className="text-slate-400">CEP:</span></div>
              <div className="border border-slate-300 rounded p-1.5"><span className="text-slate-400">UF:</span></div>
              <div className="border border-slate-300 rounded p-1.5"><span className="text-slate-400">Cidade:</span></div>
              <div className="col-span-2 border border-slate-300 rounded p-1.5"><span className="text-slate-400">Logradouro/Rua:</span></div>
              <div className="border border-slate-300 rounded p-1.5"><span className="text-slate-400">Número:</span></div>
              <div className="border border-slate-300 rounded p-1.5"><span className="text-slate-400">Bairro:</span></div>
              <div className="col-span-2 border border-slate-300 rounded p-1.5"><span className="text-slate-400">Complemento:</span></div>
            </div>
          </div>
        );

      case "table":
        return (
          <div key={field.id} className="col-span-full border border-slate-300 rounded p-2.5 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </label>
            <div className="border border-slate-400 rounded overflow-hidden">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-400">
                    <th className="p-1.5 border-r border-slate-300 w-1/3">Item / Descrição</th>
                    <th className="p-1.5 border-r border-slate-300 w-1/3">Status / Resultado</th>
                    <th className="p-1.5 w-1/3">Observações</th>
                  </tr>
                </thead>
                <tbody>
                  {[1, 2, 3].map((rowIdx) => (
                    <tr key={rowIdx} className="border-b border-slate-200 last:border-0 h-7">
                      <td className="p-1.5 border-r border-slate-200" />
                      <td className="p-1.5 border-r border-slate-200" />
                      <td className="p-1.5" />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );

      default:
        return (
          <div key={field.id} className="col-span-1 border border-slate-300 rounded p-2 bg-white">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
              {field.label}
            </label>
            <div className="h-6 border-b border-dotted border-slate-400 mt-1" />
          </div>
        );
    }
  };

  return (
    <div className="w-full bg-white text-slate-900 font-sans p-6 sm:p-8 space-y-6 print:p-0 print:m-0 print:max-w-none">
      {/* Cabeçalho da Clínica */}
      {includeHeader && (
        <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {clinicLogoUrl ? (
              <img src={clinicLogoUrl} alt={clinicName} className="h-12 max-w-[160px] object-contain" />
            ) : (
              <div className="w-10 h-10 rounded bg-slate-800 text-white flex items-center justify-center font-bold text-lg">
                {clinicName.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{clinicName}</h1>
              <p className="text-xs text-slate-600">Ficha de Atendimento & Prontuário Clínico</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-600 space-y-1">
            <div><span className="font-semibold text-slate-800">Data de Emissão:</span> {currentDate}</div>
            <div><span className="font-semibold text-slate-800">Cód. Impresso:</span> REF-{Math.floor(100000 + Math.random() * 900000)}</div>
          </div>
        </div>
      )}

      {/* 1. SEÇÃO: FICHA DE CADASTRO DO PACIENTE */}
      {includePatientRegistration && (
        <div className="space-y-3 break-inside-avoid">
          <div className="bg-slate-900 text-white px-3 py-1.5 rounded flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider">1. FICHA DE CADASTRO DO PACIENTE</h2>
            <span className="text-[10px] opacity-80">Preenchimento Obrigatório</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 text-xs">
            <div className="col-span-2 md:col-span-3 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Nome Completo do Paciente</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Data de Nascimento</label>
              <div className="text-xs text-slate-400 pt-1">___ / ___ / ______</div>
            </div>

            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CPF</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">RG / Órgão Emissor</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Sexo / Gênero</label>
              <div className="flex gap-2 pt-1 text-[11px]">
                <span>[ ] M</span> <span>[ ] F</span> <span>[ ] Outro</span>
              </div>
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Profissão / Ocupação</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>

            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Telefone / WhatsApp</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 md:col-span-2 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">E-mail</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Estado Civil</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>

            <div className="col-span-2 md:col-span-3 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Endereço Residencial (Rua, Nº, Bairro)</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CEP / Cidade - UF</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>

            <div className="col-span-2 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Responsável Legal / Financeiro (se menor ou dependente)</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">CPF do Responsável</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Telefone do Responsável</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>

            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Plano de Saúde / Convênio</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-1 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Nº da Carteirinha / Matrícula</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
            <div className="col-span-2 border border-slate-300 rounded p-2">
              <label className="block text-[10px] font-bold text-slate-600 uppercase">Contato de Emergência (Nome e Telefone)</label>
              <div className="h-5 border-b border-dotted border-slate-400" />
            </div>
          </div>
        </div>
      )}

      {/* 2. SEÇÃO: BLOCO PADRÃO UNIVERSAL */}
      {includeUniversalBase && universalBaseSchema && universalBaseSchema.length > 0 && (
        <div className="space-y-3 break-inside-avoid">
          <div className="bg-slate-800 text-white px-3 py-1.5 rounded flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider">2. AVALIAÇÃO BASE UNIVERSAL / ANAMNESE</h2>
            <span className="text-[10px] opacity-80">Bloco Padrão da Clínica</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {universalBaseSchema.map(renderPrintableField)}
          </div>
        </div>
      )}

      {/* 3. SEÇÃO: FICHA EXTRA / TEMPLATE ESPECÍFICO */}
      {selectedTemplateName && selectedTemplateSchema && selectedTemplateSchema.length > 0 && (
        <div className="space-y-3 break-inside-avoid">
          <div className="bg-slate-700 text-white px-3 py-1.5 rounded flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider">3. FICHA ESPECÍFICA: {selectedTemplateName}</h2>
            <span className="text-[10px] opacity-80">Modelo Complementar</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {selectedTemplateSchema.map(renderPrintableField)}
          </div>
        </div>
      )}

      {/* RODAPÉ E ASSINATURA */}
      <div className="pt-6 mt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs break-inside-avoid">
        <div>
          <p className="font-semibold text-slate-700">Observações do Profissional:</p>
          <div className="border-b border-dashed border-slate-300 h-6 mt-2" />
          <div className="border-b border-dashed border-slate-300 h-6" />
        </div>
        <div className="flex flex-col justify-end text-center space-y-2">
          <div className="border-b border-slate-800 mx-auto w-3/4" />
          <p className="font-bold text-slate-900">Assinatura e Carimbo do Profissional</p>
          <p className="text-[10px] text-slate-500">Data do Atendimento: _____ / _____ / ________</p>
        </div>
      </div>
    </div>
  );
};

export default PrintBlankKitSheet;
