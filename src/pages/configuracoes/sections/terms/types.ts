export interface ClinicCustomTermItem {
  content: string;
  filename: string;
  updatedAt: string;
  originalSize?: number;
  compressedSize?: number;
  b2ObjectKey?: string;
  detectedVariables?: string[];
}

export interface ClinicTermsData {
  adult_terms?: ClinicCustomTermItem;
  minor_terms?: ClinicCustomTermItem;
  print_terms?: ClinicCustomTermItem;
}

export interface ClinicCustomDocumentTemplate {
  id: string;
  title: string;
  description?: string;
  content: string;
  filename?: string;
  updatedAt: string;
  detectedVariables?: string[];
  category?: string;
}

export type StandardEditableTermKey = "adult_terms" | "minor_terms" | "print_terms";

export interface PreviewDocState {
  title: string;
  content: string;
  badge?: string;
  isImmutable?: boolean;
  detectedVariables?: string[];
}
