import { useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Compass,
  Home,
  Info,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  X,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AddressBlockValue } from "@/lib/anamnesis-forms";

export interface ClinicOption {
  id: string;
  name: string;
  address?: string;
  cep?: string;
  city?: string;
  state?: string;
}

export interface AddressBlockInputProps {
  value?: AddressBlockValue | null;
  onChange: (value: AddressBlockValue) => void;
  disabled?: boolean;
  patientAddress?: string;
  clinics?: ClinicOption[];
  label?: string;
  helpText?: string;
  required?: boolean;
}

export interface ViaCepSearchResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
}

const BRAZIL_STATE_UF_MAP: Record<string, string> = {
  acre: "AC",
  alagoas: "AL",
  amapa: "AP",
  amapá: "AP",
  amazonas: "AM",
  bahia: "BA",
  ceara: "CE",
  ceará: "CE",
  "distrito federal": "DF",
  "espirito santo": "ES",
  "espírito santo": "ES",
  goias: "GO",
  goiás: "GO",
  maranhao: "MA",
  maranhão: "MA",
  "mato grosso": "MT",
  "mato grosso do sul": "MS",
  "minas gerais": "MG",
  para: "PA",
  pará: "PA",
  paraiba: "PB",
  paraíba: "PB",
  parana: "PR",
  paraná: "PR",
  pernambuco: "PE",
  piaui: "PI",
  piauí: "PI",
  "rio de janeiro": "RJ",
  "rio grande do norte": "RN",
  "rio grande do sul": "RS",
  rondonia: "RO",
  rondônia: "RO",
  roraima: "RR",
  "santa catarina": "SC",
  "sao paulo": "SP",
  "são paulo": "SP",
  sergipe: "SE",
  tocantins: "TO",
};

export const normalizeStateUf = (value?: string | null): string => {
  if (!value) return "";
  const clean = value.trim().toLowerCase();
  if (BRAZIL_STATE_UF_MAP[clean]) {
    return BRAZIL_STATE_UF_MAP[clean];
  }
  const alphaOnly = value.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (alphaOnly.length === 2) {
    return alphaOnly;
  }
  return value.trim().toUpperCase().slice(0, 2);
};

export const AddressBlockInput = ({
  value = {},
  onChange,
  disabled = false,
  patientAddress,
  clinics = [],
  label,
  helpText,
  required,
}: AddressBlockInputProps) => {
  const [loadingCep, setLoadingCep] = useState(false);
  const [loadingGps, setLoadingGps] = useState(false);
  const [loadingAddressSearch, setLoadingAddressSearch] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [unknownCep, setUnknownCep] = useState<boolean>(value?.cep === "Não informado");
  const [searchResults, setSearchResults] = useState<ViaCepSearchResult[] | null>(null);
  const [showGpsHelpModal, setShowGpsHelpModal] = useState(false);

  const currentValue: AddressBlockValue = value || {};

  const updateFields = (changes: Partial<AddressBlockValue>) => {
    onChange({
      ...currentValue,
      ...changes,
    });
  };

  const handleCepChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const rawCep = e.target.value;
    const cleanCep = rawCep.replace(/\D/g, "").slice(0, 8);

    let formattedCep = cleanCep;
    if (cleanCep.length > 5) {
      formattedCep = `${cleanCep.slice(0, 5)}-${cleanCep.slice(5)}`;
    }

    updateFields({ cep: formattedCep });

    if (cleanCep.length === 8) {
      await fetchAddressByCep(cleanCep);
    }
  };

  const fetchAddressByCep = async (cleanCep: string) => {
    setLoadingCep(true);
    setGeoError(null);
    setSearchResults(null);
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data.erro) {
        setGeoError("CEP não encontrado.");
      } else {
        updateFields({
          cep: data.cep || cleanCep,
          state: normalizeStateUf(data.uf),
          city: data.localidade || "",
          neighborhood: data.bairro || "",
          street: data.logradouro || "",
        });
      }
    } catch {
      setGeoError("Erro ao buscar CEP. Preencha os dados manualmente.");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSearchCepByAddress = async () => {
    const uf = normalizeStateUf(currentValue.state);
    const city = (currentValue.city || "").trim();
    const street = (currentValue.street || "").trim();

    if (!uf || uf.length !== 2 || !city || city.length < 3 || !street || street.length < 3) {
      setGeoError("Preencha Estado (UF), Cidade e pelo menos 3 letras da Rua para buscar o CEP.");
      return;
    }

    setLoadingAddressSearch(true);
    setGeoError(null);
    setSearchResults(null);

    try {
      const response = await fetch(
        `https://viacep.com.br/ws/${encodeURIComponent(uf)}/${encodeURIComponent(city)}/${encodeURIComponent(street)}/json/`
      );
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data as ViaCepSearchResult[]);
      } else {
        setGeoError("Nenhum CEP encontrado para o endereço informado.");
      }
    } catch {
      setGeoError("Erro ao buscar CEP pelo endereço.");
    } finally {
      setLoadingAddressSearch(false);
    }
  };

  const handleSelectSearchResult = (item: ViaCepSearchResult) => {
    setUnknownCep(false);
    setSearchResults(null);
    updateFields({
      cep: item.cep,
      state: normalizeStateUf(item.uf),
      city: item.localidade,
      neighborhood: item.bairro,
      street: item.logradouro,
    });
  };

  const handleToggleUnknownCep = (checked: boolean) => {
    setUnknownCep(checked);
    setSearchResults(null);
    if (checked) {
      updateFields({ cep: "Não informado" });
    } else if (currentValue.cep === "Não informado") {
      updateFields({ cep: "" });
    }
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocalização não é suportada neste navegador.");
      return;
    }

    setLoadingGps(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const capturedAt = new Date().toISOString();
        const roundedAccuracy = Math.round(accuracy);

        updateFields({
          latitude,
          longitude,
          accuracy: roundedAccuracy,
          capturedAt,
          locationType: currentValue.locationType || "custom",
        });

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
          );
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const newCep = addr.postcode ? addr.postcode.replace(/\D/g, "") : currentValue.cep || "";
            const formattedCep = newCep.length === 8 ? `${newCep.slice(0, 5)}-${newCep.slice(5)}` : newCep;
            const rawState = addr.state_code || addr.state || currentValue.state || "";
            const uf = normalizeStateUf(rawState);

            updateFields({
              latitude,
              longitude,
              accuracy: roundedAccuracy,
              capturedAt,
              cep: formattedCep || currentValue.cep,
              state: uf,
              city: addr.city || addr.town || addr.village || currentValue.city || "",
              neighborhood: addr.suburb || addr.neighbourhood || currentValue.neighborhood || "",
              street: addr.road || currentValue.street || "",
              number: addr.house_number || currentValue.number || "",
            });
          }
        } catch {
          // Keep captured lat/lng
        } finally {
          setLoadingGps(false);
        }
      },
      (error) => {
        setLoadingGps(false);
        if (error.code === error.PERMISSION_DENIED) {
          setGeoError("Permissão de geolocalização negada no navegador.");
        } else {
          setGeoError("Não foi possível obter sua localização exata.");
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleClearGps = () => {
    updateFields({
      latitude: null,
      longitude: null,
      accuracy: null,
      capturedAt: null,
    });
  };

  const handleSelectClinic = (clinic: ClinicOption) => {
    if (currentValue.clinicId === clinic.id) {
      updateFields({
        locationType: "custom",
        clinicId: null,
        clinicName: undefined,
      });
    } else {
      updateFields({
        locationType: "clinic",
        clinicId: clinic.id,
        clinicName: clinic.name,
        street: clinic.address || currentValue.street,
        city: clinic.city || currentValue.city,
        state: normalizeStateUf(clinic.state || currentValue.state),
        cep: clinic.cep || currentValue.cep,
      });
    }
  };

  const handleSelectHomeVisit = () => {
    if (currentValue.locationType === "home_visit") {
      updateFields({
        locationType: "custom",
        clinicId: null,
        clinicName: undefined,
      });
    } else {
      updateFields({
        locationType: "home_visit",
        clinicId: null,
        clinicName: undefined,
        street: patientAddress || currentValue.street,
      });
    }
  };

  const isBadAccuracy = typeof currentValue.accuracy === "number" && currentValue.accuracy > 3000;

  return (
    <div className="space-y-4 rounded-xl border border-border/80 bg-card p-4 shadow-sm">
      {/* Preset Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
            {label || "Local de Atendimento & Endereço"}
            {required && <span className="ml-1 text-destructive">*</span>}
          </span>
          {helpText && <p className="text-xs text-muted-foreground font-normal normal-case mt-0.5">{helpText}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {clinics.map((clinic) => (
            <Button
              key={clinic.id}
              type="button"
              variant={currentValue.clinicId === clinic.id ? "default" : "outline"}
              size="sm"
              disabled={disabled}
              onClick={() => handleSelectClinic(clinic)}
              className="h-8 text-xs gap-1.5"
            >
              <Building2 className="h-3.5 w-3.5" />
              {clinic.name}
            </Button>
          ))}

          <Button
            type="button"
            variant={currentValue.locationType === "home_visit" ? "default" : "outline"}
            size="sm"
            disabled={disabled}
            onClick={handleSelectHomeVisit}
            className="h-8 text-xs gap-1.5"
          >
            <Home className="h-3.5 w-3.5" />
            Domiciliar
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || loadingGps}
            onClick={handleGeolocation}
            className="h-8 text-xs gap-1.5"
          >
            {loadingGps ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Compass className="h-3.5 w-3.5" />}
            Usar GPS
          </Button>
        </div>
      </div>

      {/* GPS Status Indicator Banner */}
      {currentValue.latitude && currentValue.longitude && (
        isBadAccuracy ? (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="flex-1 min-w-0">
                <span className="font-semibold">Localização por IP/Rede (precisão ampla: ±{Math.round(currentValue.accuracy! / 1000)}km):</span> Lat {currentValue.latitude.toFixed(4)}, Lng {currentValue.longitude.toFixed(4)}.
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGpsHelpModal(true)}
                className="h-7 px-2 text-xs gap-1 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
                title="Ver dicas para melhorar a precisão do GPS"
              >
                <Info className="h-3.5 w-3.5" />
                Dicas
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearGps}
                className="h-7 w-7 p-0 text-amber-900 dark:text-amber-200 hover:bg-amber-500/20"
                title="Remover coordenadas GPS"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div className="flex-1 min-w-0">
                <span className="font-medium">Localização GPS capturada:</span> Lat {currentValue.latitude.toFixed(5)}, Lng {currentValue.longitude.toFixed(5)}
                {currentValue.accuracy && ` (precisão: ±${currentValue.accuracy}m)`}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGpsHelpModal(true)}
                className="h-7 px-2 text-xs gap-1 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20"
                title="Ver informações da localização"
              >
                <Info className="h-3.5 w-3.5" />
                Dicas
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearGps}
                className="h-7 w-7 p-0 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-500/20"
                title="Remover coordenadas GPS"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )
      )}

      {geoError && (
        <div className="text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{geoError}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowGpsHelpModal(true)}
              className="h-7 px-2 text-xs gap-1 text-destructive hover:bg-destructive/10"
            >
              <Info className="h-3.5 w-3.5" />
              Dicas
            </Button>
            <X className="h-3.5 w-3.5 cursor-pointer shrink-0" onClick={() => setGeoError(null)} />
          </div>
        </div>
      )}

      {/* Address Form Inputs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-1">
            <Label className="text-xs">CEP</Label>
            <div className="flex items-center gap-1.5">
              <Checkbox
                id="unknown_cep_checkbox"
                checked={unknownCep}
                onCheckedChange={(checked) => handleToggleUnknownCep(checked === true)}
                disabled={disabled}
              />
              <Label htmlFor="unknown_cep_checkbox" className="text-[11px] font-normal cursor-pointer text-muted-foreground">
                Não sei o CEP
              </Label>
            </div>
          </div>
          <div className="relative">
            <Input
              value={unknownCep ? "Não informado" : currentValue.cep || ""}
              onChange={handleCepChange}
              placeholder="00000-000"
              maxLength={9}
              disabled={disabled || loadingCep || unknownCep}
              className="pr-8"
            />
            {!unknownCep && (
              <div className="absolute right-2.5 top-2.5 text-muted-foreground">
                {loadingCep ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search
                    className="h-4 w-4 cursor-pointer hover:text-foreground"
                    onClick={() => {
                      const clean = (currentValue.cep || "").replace(/\D/g, "");
                      if (clean.length === 8) fetchAddressByCep(clean);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Estado (UF)</Label>
          <Input
            value={currentValue.state || ""}
            onChange={(e) => updateFields({ state: normalizeStateUf(e.target.value) })}
            placeholder="Ex: SP"
            maxLength={2}
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Cidade</Label>
          <Input
            value={currentValue.city || ""}
            onChange={(e) => updateFields({ city: e.target.value })}
            placeholder="Ex: São Paulo"
            disabled={disabled}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5 sm:col-span-2">
          <div className="flex items-center justify-between gap-1">
            <Label className="text-xs">Rua / Logradouro</Label>
            {unknownCep && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[11px] text-primary gap-1"
                disabled={disabled || loadingAddressSearch}
                onClick={handleSearchCepByAddress}
              >
                {loadingAddressSearch ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                Buscar CEP pelo endereço
              </Button>
            )}
          </div>
          <Input
            value={currentValue.street || ""}
            onChange={(e) => updateFields({ street: e.target.value })}
            placeholder="Ex: Av. Paulista"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Número</Label>
          <Input
            value={currentValue.number || ""}
            onChange={(e) => updateFields({ number: e.target.value })}
            placeholder="Ex: 1000"
            disabled={disabled}
          />
        </div>
      </div>

      {/* Address Search CEP Results List */}
      {searchResults && searchResults.length > 0 && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-muted-foreground">
            <span>CEPs encontrados ({searchResults.length}):</span>
            <X className="h-3.5 w-3.5 cursor-pointer" onClick={() => setSearchResults(null)} />
          </div>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {searchResults.map((item, idx) => (
              <div
                key={`${item.cep}_${idx}`}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-background border hover:border-primary cursor-pointer transition-colors"
                onClick={() => handleSelectSearchResult(item)}
              >
                <div>
                  <p className="font-semibold text-foreground">{item.cep}</p>
                  <p className="text-[11px] text-muted-foreground">{item.logradouro} - {item.bairro}, {item.localidade}/{item.uf}</p>
                </div>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2">
                  Usar CEP
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Bairro</Label>
          <Input
            value={currentValue.neighborhood || ""}
            onChange={(e) => updateFields({ neighborhood: e.target.value })}
            placeholder="Ex: Bela Vista"
            disabled={disabled}
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Complemento</Label>
          <Input
            value={currentValue.complement || ""}
            onChange={(e) => updateFields({ complement: e.target.value })}
            placeholder="Ex: Apt 42, Bloco B"
            disabled={disabled}
          />
        </div>
      </div>

      {/* GPS Help & Guidance Modal */}
      <Dialog open={showGpsHelpModal} onOpenChange={setShowGpsHelpModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Compass className="h-5 w-5 text-primary" />
              Dicas de Geolocalização (GPS & Permissões)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Entenda como a captura de localização funciona e como obter a máxima precisão no seu dispositivo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-foreground py-2">
            <div className="rounded-lg bg-muted/40 p-3 space-y-1">
              <p className="font-semibold text-foreground">📍 Por que a localização deu imprecisa ou por IP?</p>
              <p className="text-muted-foreground leading-relaxed">
                Em computadores de mesa ou notebooks conectados por cabo/Wi-Fi sem chip GPS ativo, o navegador usa a aproximação pelo IP do provedor de internet (que pode estar registrado na central da operadora em outra cidade).
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">Como ativar a precisão real no seu dispositivo:</p>
              <ul className="space-y-2 text-muted-foreground list-disc pl-4">
                <li>
                  <strong className="text-foreground">No Windows (10 / 11):</strong> Vá em <em>Configurações &gt; Privacidade e Segurança &gt; Localização</em>. Ative a opção <em>"Permitir que os aplicativos acessem sua localização"</em> e garanta que seu navegador (Chrome, Edge ou Firefox) tenha permissão ativada.
                </li>
                <li>
                  <strong className="text-foreground">No macOS:</strong> Vá em <em>Ajustes do Sistema &gt; Privacidade e Segurança &gt; Serviços de Localização</em> e ative a permissão para o seu navegador.
                </li>
                <li>
                  <strong className="text-foreground">No Navegador (Chrome/Edge/Safari):</strong> Clique no ícone de configurações ao lado do endereço na barra de URL (cadeado) e garanta que <em>Localização</em> está em <strong>Permitir</strong>.
                </li>
                <li>
                  <strong className="text-foreground">No Celular / App PWA:</strong> Ative a localização/GPS nas configurações rápidas do Android ou iOS para obter precisão de poucos metros.
                </li>
              </ul>
            </div>

            {currentValue.latitude && currentValue.longitude && (
              <div className="border-t pt-2 space-y-1">
                <p className="font-semibold">Coordenadas atuais capturadas:</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  Lat: {currentValue.latitude}, Lng: {currentValue.longitude}
                  {currentValue.accuracy && ` (Margem de erro: ±${currentValue.accuracy}m)`}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowGpsHelpModal(false);
                handleGeolocation();
              }}
              className="text-xs gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Tentar novamente agora
            </Button>
            <Button type="button" size="sm" onClick={() => setShowGpsHelpModal(false)} className="text-xs">
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
