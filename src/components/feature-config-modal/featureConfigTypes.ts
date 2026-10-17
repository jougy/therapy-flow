import type { FeatureFlagDefinition } from "@/lib/feature-flags-catalog";

export interface FeatureConfigModalProps {
  featureKey: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSave?: (payload: Record<string, unknown>) => void;
  initialData?: Record<string, unknown>;
  scope?: "global" | "tag" | "clinic";
  tagId?: string;
  clinicId?: string;
}

export interface FeatureSubFormProps {
  formData: Record<string, unknown>;
  setFormData: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  feature?: FeatureFlagDefinition;
}
