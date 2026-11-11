export type PersonType = "PF" | "PJ";

export interface AffiliateFormData {
  name: string;
  email: string;
  fiscalEmail: string;
  cpfCnpj: string;
  mobilePhone: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  province: string;
  city: string;
  state: string;
  pixKeyType: string;
  pixKey: string;
  bankName: string;
  bankAgency: string;
  bankAccount: string;
  totpCode: string;
  acceptedTerms: boolean;
}

export interface AffiliateOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  affiliateId?: string;
  defaultName?: string;
  defaultEmail?: string;
  onSuccess?: (data: { couponCode: string; referralLink: string }) => void;
  onNavigateToPanel?: () => void;
}
