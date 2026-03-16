import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Save, Printer, Share2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { useState } from "react";

const SessaoDetalhe = () => {
  const { id, sessionId } = useParams();
  const navigate = useNavigate();
  const [painScore, setPainScore] = useState([4]);
  const [complexityScore, setComplexityScore] = useState([6]);

  const painColor =
    painScore[0] <= 3 ? "text-success" : painScore[0] <= 6 ? "text-warning" : "text-destructive";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/pacientes/${id}`)}
            aria-label="Voltar para paciente"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Atendimento — 12/03/2026</h1>
            <p className="text-sm text-muted-foreground">Ana Silva · Cervicalgia · 14:00 - 15:00</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-success/15 text-success border-success/20">
            Concluído
          </Badge>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex gap-2 flex-wrap">
        <Button size="sm">
          <Save className="h-4 w-4 mr-2" />
          <span>Salvar</span>
        </Button>
        <Button size="sm" variant="outline">
          <Copy className="h-4 w-4 mr-2" />
          <span>Novo a partir deste</span>
        </Button>
        <Button size="sm" variant="outline">
          <Printer className="h-4 w-4 mr-2" />
          <span>Imprimir</span>
        </Button>
        <Button size="sm" variant="outline">
          <Share2 className="h-4 w-4 mr-2" />
          <span>Compartilhar</span>
        </Button>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="anamnese" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="anamnese" className="flex-1 max-w-[200px]">
            Anamnese
          </TabsTrigger>
          <TabsTrigger value="tratamento" className="flex-1 max-w-[200px]">
            Tratamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="anamnese" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <Label htmlFor="queixa" className="text-sm font-medium">
                  Queixa Principal
                </Label>
                <Textarea
                  id="queixa"
                  defaultValue="Dor cervical após longa jornada de trabalho"
                  className="mt-1.5"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="sintomas" className="text-sm font-medium">
                  Sintomas
                </Label>
                <div className="flex gap-1.5 flex-wrap mt-1.5">
                  {["Dor cervical", "Rigidez matinal"].map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">
                      {s} ×
                    </Badge>
                  ))}
                  <Input
                    id="sintomas"
                    placeholder="Adicionar sintoma..."
                    className="w-40 h-6 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">
                    Nota da Dor (Paciente): <span className={`font-bold ${painColor}`}>{painScore[0]}/10</span>
                  </Label>
                  <Slider
                    value={painScore}
                    onValueChange={setPainScore}
                    max={10}
                    step={1}
                    className="mt-3"
                    aria-label="Nota da dor reportada pelo paciente"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">
                    Nota de Complexidade (Profissional): <span className="font-bold">{complexityScore[0]}/10</span>
                  </Label>
                  <Slider
                    value={complexityScore}
                    onValueChange={setComplexityScore}
                    max={10}
                    step={1}
                    className="mt-3"
                    aria-label="Nota de complexidade pelo profissional"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="observacoes" className="text-sm font-medium">
                  Observações
                </Label>
                <Textarea
                  id="observacoes"
                  placeholder="Observações adicionais sobre a anamnese..."
                  className="mt-1.5"
                  rows={4}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tratamento" className="mt-4 space-y-4">
          <Card>
            <CardContent className="p-6 space-y-5">
              <div>
                <Label htmlFor="tecnicas" className="text-sm font-medium">
                  Técnicas Aplicadas
                </Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {[
                    "Mobilização articular",
                    "Alongamento",
                    "Liberação miofascial",
                    "Eletroterapia",
                    "Cinesioterapia",
                    "Termoterapia",
                    "Crioterapia",
                    "Acupuntura",
                    "Bandagem funcional",
                  ].map((tech) => (
                    <label
                      key={tech}
                      className="flex items-center gap-2 p-2 rounded-md border cursor-pointer hover:bg-accent/50 transition-colors text-sm"
                    >
                      <input type="checkbox" className="rounded border-input" />
                      <span>{tech}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="descricao-tratamento" className="text-sm font-medium">
                  Descrição do Tratamento
                </Label>
                <Textarea
                  id="descricao-tratamento"
                  placeholder="Descreva o tratamento realizado..."
                  className="mt-1.5"
                  rows={4}
                />
              </div>

              <div>
                <Label htmlFor="orientacoes" className="text-sm font-medium">
                  Orientações ao Paciente
                </Label>
                <Textarea
                  id="orientacoes"
                  placeholder="Orientações e exercícios para casa..."
                  className="mt-1.5"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
};

export default SessaoDetalhe;
