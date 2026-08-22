import React, { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  BarChart3,
  PieChart as PieChartIcon,
  Sparkles,
  HelpCircle,
  Hash,
  Sliders,
  CheckSquare,
  CircleDot,
  AlignLeft,
  Calendar,
  Layers,
  Activity,
  MapPin,
  Table as TableIcon,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { AnamnesisField, AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

export interface SessionDataForAnalytics {
  id: string;
  patient_id: string;
  provider_id?: string | null;
  session_date: string;
  status: string;
  user_id: string;
  anamnesis?: unknown;
  anamnesis_form_response?: unknown;
  pain_score?: number | null;
  complexity_score?: number | null;
}

export interface ClinicFormAnalyticsDashboardProps {
  templateName: string;
  schema: AnamnesisTemplateSchema;
  sessions: SessionDataForAnalytics[];
}

const PALETTE = [
  "#0ea5e9", // Sky
  "#6366f1", // Indigo
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Purple
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#3b82f6", // Blue
  "#84cc16", // Lime
];

const isFormResponseRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const readFieldValueFromSession = (field: AnamnesisField, session: SessionDataForAnalytics): unknown => {
  if (field.systemKey === "pain_score") {
    return typeof session.pain_score === "number" ? session.pain_score : undefined;
  }
  if (field.systemKey === "complexity_score") {
    return typeof session.complexity_score === "number" ? session.complexity_score : undefined;
  }
  if (field.systemKey === "queixa" || field.systemKey === "sintomas" || field.systemKey === "observacoes") {
    if (isFormResponseRecord(session.anamnesis)) {
      const raw = session.anamnesis[field.systemKey];
      if (typeof raw === "string" && raw.trim()) return raw.trim();
    }
  }

  const responseObj = isFormResponseRecord(session.anamnesis_form_response) ? session.anamnesis_form_response : {};
  return responseObj[field.id];
};

export const ClinicFormAnalyticsDashboard: React.FC<ClinicFormAnalyticsDashboardProps> = ({
  templateName,
  schema,
  sessions,
}) => {
  const questionFields = useMemo(
    () =>
      schema.filter(
        (f) =>
          f.type !== "section" &&
          f.type !== "horizontal_section" &&
          f.type !== "section_selector"
      ),
    [schema]
  );

  const totalSessions = sessions.length;

  if (totalSessions === 0) {
    return (
      <Card className="border-dashed border-2 bg-muted/20">
        <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center max-w-md mx-auto space-y-3">
          <div className="rounded-2xl bg-primary/10 p-3.5 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">Nenhum atendimento realizado com esta ficha ainda</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Assim que você e sua equipe começarem a atender pacientes e salvarem consultas usando este formulário, os gráficos de respostas estilo Google Forms aparecerão automaticamente aqui!
            </p>
          </div>
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-left text-xs text-muted-foreground w-full space-y-1 mt-2">
            <div className="flex items-center gap-1.5 font-semibold text-primary">
              <HelpCircle className="h-3.5 w-3.5" />
              <span>Como funciona este painel?</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              O sistema lê todas as respostas dadas pelos pacientes e monta gráficos automáticos de porcentagem, médias de notas e distribuição de sintomas.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner Informativo para Leigos */}
      <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground/90">
        <div className="rounded-lg bg-primary/10 p-2 text-primary shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="space-y-0.5">
          <p className="font-semibold text-foreground">
            Painel Geral de Respostas da Clínica ({totalSessions} {totalSessions === 1 ? "atendimento" : "atendimentos"} analisados)
          </p>
          <p className="text-muted-foreground text-[11px]">
            Abaixo você visualiza os gráficos automáticos gerados a partir de todas as respostas preenchidas nos atendimentos dos seus pacientes.
          </p>
        </div>
      </div>

      {/* Grid de Cards de Analytics por Pergunta */}
      <div className="grid gap-5">
        {questionFields.map((field, fieldIndex) => {
          const rawValues = sessions.map((s) => readFieldValueFromSession(field, s));
          const answeredValues = rawValues.filter(
            (v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
          );
          const answeredCount = answeredValues.length;
          const answeredPct = Math.round((answeredCount / totalSessions) * 100);

          return (
            <Card key={field.id} className="overflow-hidden border-border/80 shadow-xs">
              <CardHeader className="bg-muted/30 pb-3 border-b border-border/40">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                        {fieldIndex + 1}
                      </span>
                      <CardTitle className="text-sm font-bold text-foreground">
                        {field.label}
                      </CardTitle>
                    </div>
                    {field.helpText && (
                      <CardDescription className="text-xs italic pl-7">
                        {field.helpText}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-medium">
                      {answeredCount} de {totalSessions} ({answeredPct}%) preenchidos
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5">
                {answeredCount === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-3 text-center">
                    Nenhum paciente respondeu a esta pergunta específica ainda.
                  </p>
                ) : (
                  <>
                    {/* 1. SELEÇÃO ÚNICA / MÚLTIPLA ESCOLHA / DROPLIST */}
                    {(field.type === "multiple_choice" || field.type === "select") && (
                      <ChoiceQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}

                    {/* 2. CHECKLIST (MÚLTIPLA SELEÇÃO) */}
                    {field.type === "checklist" && (
                      <ChecklistQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}

                    {/* 3. SLIDER / ESCALA DE DOR (EVA) */}
                    {field.type === "slider" && (
                      <SliderQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}

                    {/* 4. NÚMEROS */}
                    {field.type === "number" && (
                      <NumberQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}

                    {/* 5. TEXTO CURTO OU LONGO */}
                    {(field.type === "short_text" || field.type === "long_text") && (
                      <TextQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}

                    {/* 6. DATA */}
                    {field.type === "date" && (
                      <DateQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}

                    {/* 7. ENDEREÇO */}
                    {field.type === "address_block" && (
                      <AddressQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}

                    {/* 8. TABELA */}
                    {field.type === "table" && (
                      <TableQuestionAnalytics field={field} values={answeredValues} totalAnswered={answeredCount} />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

// -------------------------------------------------------------
// SUB-COMPONENTES DE ANALYTICS ESPECÍFICOS POR TIPO DE CAMPO
// -------------------------------------------------------------

const ChoiceQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ field, values, totalAnswered }) => {
  const optionsMap = useMemo(() => {
    const map = new Map<string, string>();
    (field.options ?? []).forEach((opt) => map.set(opt.id, opt.label));
    return map;
  }, [field.options]);

  const stats = useMemo(() => {
    const counts = new Map<string, number>();
    values.forEach((v) => {
      const key = String(v);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    const data: Array<{ name: string; count: number; pct: number }> = [];
    counts.forEach((count, key) => {
      const label = optionsMap.get(key) || key;
      const pct = Math.round((count / totalAnswered) * 100);
      data.push({ name: label, count, pct });
    });

    data.sort((a, b) => b.count - a.count);
    return data;
  }, [values, optionsMap, totalAnswered]);

  return (
    <div className="space-y-4">
      {/* Helper explicativo */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <PieChartIcon className="h-3.5 w-3.5 text-primary" />
        <span>💡 Mostra a divisão de escolhas e a opção predominante entre os pacientes.</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        {/* Gráfico de Pizza / Donut */}
        <div className="h-44 w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={stats}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={68}
                paddingAngle={3}
              >
                {stats.map((_, index) => (
                  <Cell key={index} fill={PALETTE[index % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} respostas (${Math.round((value / totalAnswered) * 100)}%)`, "Frequência"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Lista de Barras Proporcionais */}
        <div className="space-y-2.5">
          {stats.map((item, idx) => (
            <div key={item.name} className="space-y-1">
              <div className="flex justify-between text-xs font-medium">
                <span className="flex items-center gap-1.5 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                  />
                  <span className="truncate text-foreground">{item.name}</span>
                </span>
                <span className="text-muted-foreground shrink-0 font-mono">
                  {item.count} ({item.pct}%)
                </span>
              </div>
              <Progress value={item.pct} className="h-1.5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ChecklistQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ field, values, totalAnswered }) => {
  const optionsMap = useMemo(() => {
    const map = new Map<string, string>();
    (field.options ?? []).forEach((opt) => map.set(opt.id, opt.label));
    return map;
  }, [field.options]);

  const stats = useMemo(() => {
    const counts = new Map<string, number>();

    values.forEach((val) => {
      if (Array.isArray(val)) {
        val.forEach((item) => {
          const key = String(item);
          counts.set(key, (counts.get(key) ?? 0) + 1);
        });
      } else if (typeof val === "string" && val.trim()) {
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
    });

    const data: Array<{ name: string; count: number; pct: number }> = [];
    counts.forEach((count, key) => {
      const label = optionsMap.get(key) || key;
      const pct = Math.round((count / totalAnswered) * 100);
      data.push({ name: label, count, pct });
    });

    data.sort((a, b) => b.count - a.count);
    return data;
  }, [values, optionsMap, totalAnswered]);

  return (
    <div className="space-y-4">
      {/* Helper explicativo */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <CheckSquare className="h-3.5 w-3.5 text-primary" />
        <span>💡 Mostra quais opções foram mais marcadas nos atendimentos (um paciente pode marcar mais de uma).</span>
      </div>

      <div className="space-y-3">
        {stats.map((item, idx) => (
          <div key={item.name} className="space-y-1">
            <div className="flex justify-between text-xs font-medium">
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: PALETTE[idx % PALETTE.length] }}
                />
                <span className="truncate text-foreground">{item.name}</span>
              </span>
              <span className="text-muted-foreground shrink-0 font-mono">
                {item.count} pacientes ({item.pct}%)
              </span>
            </div>
            <Progress value={item.pct} className="h-2" />
          </div>
        ))}
      </div>
    </div>
  );
};

const SliderQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ field, values, totalAnswered }) => {
  const minVal = field.min ?? 0;
  const maxVal = field.max ?? 10;

  const { average, distribution, tiers } = useMemo(() => {
    const numbers = values
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((n) => Number.isFinite(n));

    const total = numbers.reduce((acc, n) => acc + n, 0);
    const avg = numbers.length > 0 ? (total / numbers.length).toFixed(1) : "0.0";

    const distMap = new Map<number, number>();
    for (let i = minVal; i <= maxVal; i++) {
      distMap.set(i, 0);
    }
    numbers.forEach((n) => {
      const rounded = Math.round(n);
      distMap.set(rounded, (distMap.get(rounded) ?? 0) + 1);
    });

    const distData = Array.from(distMap.entries()).map(([score, count]) => ({
      score: `${score}`,
      count,
    }));

    // Tiers clínicos
    let semDor = 0;
    let leve = 0;
    let moderada = 0;
    let intensa = 0;

    numbers.forEach((n) => {
      if (n === 0) semDor++;
      else if (n <= 3) leve++;
      else if (n <= 7) moderada++;
      else intensa++;
    });

    return {
      average: avg,
      distribution: distData,
      tiers: {
        semDor: { count: semDor, pct: Math.round((semDor / totalAnswered) * 100) },
        leve: { count: leve, pct: Math.round((leve / totalAnswered) * 100) },
        moderada: { count: moderada, pct: Math.round((moderada / totalAnswered) * 100) },
        intensa: { count: intensa, pct: Math.round((intensa / totalAnswered) * 100) },
      },
    };
  }, [values, minVal, maxVal, totalAnswered]);

  return (
    <div className="space-y-4">
      {/* Helper explicativo */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <Sliders className="h-3.5 w-3.5 text-primary" />
        <span>💡 Acompanhe a nota média e a gravidade dos pacientes avaliados com esta escala.</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
          <p className="text-[11px] font-bold text-muted-foreground uppercase">Média Geral</p>
          <p className="text-2xl font-black text-primary mt-1">{average}</p>
          <p className="text-[10px] text-muted-foreground">de {minVal} a {maxVal}</p>
        </div>

        <div className="rounded-xl border p-3 text-center">
          <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">Leve (0-3)</p>
          <p className="text-xl font-bold text-foreground mt-1">{tiers.semDor.count + tiers.leve.count}</p>
          <p className="text-[10px] text-muted-foreground">{tiers.semDor.pct + tiers.leve.pct}% dos pacientes</p>
        </div>

        <div className="rounded-xl border p-3 text-center">
          <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">Moderada (4-7)</p>
          <p className="text-xl font-bold text-foreground mt-1">{tiers.moderada.count}</p>
          <p className="text-[10px] text-muted-foreground">{tiers.moderada.pct}% dos pacientes</p>
        </div>

        <div className="rounded-xl border p-3 text-center">
          <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">Intensa (8-10)</p>
          <p className="text-xl font-bold text-foreground mt-1">{tiers.intensa.count}</p>
          <p className="text-[10px] text-muted-foreground">{tiers.intensa.pct}% dos pacientes</p>
        </div>
      </div>

      {/* Histograma de Notas */}
      <div className="h-40 w-full pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={distribution} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <XAxis dataKey="score" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number) => [`${value} pacientes`, "Frequência"]}
              labelFormatter={(label) => `Nota ${label}`}
            />
            <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const NumberQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ values }) => {
  const stats = useMemo(() => {
    const nums = values
      .map((v) => (typeof v === "number" ? v : Number(v)))
      .filter((n) => Number.isFinite(n));

    if (nums.length === 0) return { avg: 0, min: 0, max: 0 };

    const total = nums.reduce((a, b) => a + b, 0);
    return {
      avg: (total / nums.length).toFixed(1),
      min: Math.min(...nums),
      max: Math.max(...nums),
    };
  }, [values]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <Hash className="h-3.5 w-3.5 text-primary" />
        <span>💡 Valores estatísticos consolidados dos atendimentos.</span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border p-3 text-center">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Média</p>
          <p className="text-xl font-bold text-foreground mt-1">{stats.avg}</p>
        </div>
        <div className="rounded-xl border p-3 text-center">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Menor Valor</p>
          <p className="text-xl font-bold text-foreground mt-1">{stats.min}</p>
        </div>
        <div className="rounded-xl border p-3 text-center">
          <p className="text-[10px] uppercase font-bold text-muted-foreground">Maior Valor</p>
          <p className="text-xl font-bold text-foreground mt-1">{stats.max}</p>
        </div>
      </div>
    </div>
  );
};

const TextQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ values }) => {
  const recentAnswers = useMemo(() => {
    return values
      .map((v) => String(v).trim())
      .filter(Boolean)
      .slice(0, 5);
  }, [values]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <AlignLeft className="h-3.5 w-3.5 text-primary" />
        <span>💡 Amostra das anotações e respostas mais recentes registradas nos pacientes.</span>
      </div>

      <div className="space-y-2">
        {recentAnswers.map((text, idx) => (
          <div key={idx} className="rounded-lg border border-border/70 bg-background p-3 text-xs text-foreground/90 leading-relaxed italic">
            &ldquo;{text}&rdquo;
          </div>
        ))}
      </div>
    </div>
  );
};

const DateQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ values }) => {
  const count = values.length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <Calendar className="h-3.5 w-3.5 text-primary" />
        <span>💡 Datas de eventos clínicos registrados nos atendimentos.</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Registrado em <strong>{count}</strong> {count === 1 ? "atendimento" : "atendimentos"} da clínica.
      </p>
    </div>
  );
};

const AddressQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ values }) => {
  const cities = useMemo(() => {
    const map = new Map<string, number>();
    values.forEach((v) => {
      if (isFormResponseRecord(v) && typeof v.city === "string" && v.city.trim()) {
        const city = v.city.trim();
        map.set(city, (map.get(city) ?? 0) + 1);
      }
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [values]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <MapPin className="h-3.5 w-3.5 text-primary" />
        <span>💡 Cidades e localidades mais frequentes dos pacientes atendidos.</span>
      </div>

      {cities.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {cities.map(([city, count]) => (
            <Badge key={city} variant="secondary" className="text-xs gap-1.5">
              <span>{city}</span>
              <span className="font-bold text-primary">({count})</span>
            </Badge>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">Nenhum endereço registrado ainda.</p>
      )}
    </div>
  );
};

const TableQuestionAnalytics: React.FC<{
  field: AnamnesisField;
  values: unknown[];
  totalAnswered: number;
}> = ({ values }) => {
  const totalRows = useMemo(() => {
    let count = 0;
    values.forEach((v) => {
      if (Array.isArray(v)) count += v.length;
    });
    return count;
  }, [values]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md">
        <TableIcon className="h-3.5 w-3.5 text-primary" />
        <span>💡 Tabela dinâmica de dados estruturados.</span>
      </div>

      <p className="text-xs text-muted-foreground">
        Total de <strong>{totalRows}</strong> linhas de registros estruturados preenchidas nos atendimentos.
      </p>
    </div>
  );
};

export default ClinicFormAnalyticsDashboard;
