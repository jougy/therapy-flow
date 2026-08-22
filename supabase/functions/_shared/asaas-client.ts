// supabase/functions/_shared/asaas-client.ts

export interface AsaasCustomerData {
  name: string;
  email: string;
  cpfCnpj: string;
  phone?: string;
  mobilePhone?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  complement?: string;
  province?: string;
  externalReference?: string;
  notificationDisabled?: boolean;
}

export interface AsaasSubscriptionData {
  customer: string;
  billingType: 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'UNDEFINED';
  value: number;
  nextDueDate: string; // YYYY-MM-DD
  cycle: 'MONTHLY' | 'ANNUAL';
  description?: string;
  discount?: {
    value: number;
    type: 'FIXED' | 'PERCENTAGE';
  };
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
    mobilePhone?: string;
  };
  externalReference?: string;
}

export interface AsaasOneTimePaymentData {
  customer: string;
  billingType: 'CREDIT_CARD' | 'PIX' | 'BOLETO' | 'UNDEFINED';
  value: number;
  dueDate: string; // YYYY-MM-DD
  description?: string;
  externalReference?: string;
  creditCard?: {
    holderName: string;
    number: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
  };
  creditCardHolderInfo?: {
    name: string;
    email: string;
    cpfCnpj: string;
    postalCode: string;
    addressNumber: string;
    phone: string;
  };
}

export class AsaasClient {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = Deno.env.get('ASAAS_API_KEY') || '';
    const env = Deno.env.get('ASAAS_ENV') || 'sandbox';
    this.baseUrl = env === 'production'
      ? 'https://api.asaas.com/v3'
      : 'https://sandbox.asaas.com/api/v3';
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error('ASAAS_API_KEY não configurada no ambiente.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'access_token': this.apiKey,
      ...(options.headers || {}),
    };

    const response = await fetch(url, { ...options, headers });
    const json = await response.json();

    if (!response.ok) {
      const errorMessage = json.errors?.[0]?.description || response.statusText || 'Erro na API Asaas';
      throw new Error(`Asaas API Error (${response.status}): ${errorMessage}`);
    }

    return json as T;
  }

  // Customers
  async createCustomer(data: AsaasCustomerData): Promise<{ id: string; name: string; email: string; cpfCnpj: string }> {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomer(id: string, data: Partial<AsaasCustomerData>): Promise<{ id: string }> {
    return this.request(`/customers/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async findCustomerByCpfCnpj(cpfCnpj: string): Promise<{ id: string } | null> {
    const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
    const result = await this.request<{ data: Array<{ id: string }> }>(`/customers?cpfCnpj=${cleanCpfCnpj}`);
    return result.data?.[0] || null;
  }

  // Subscriptions
  async createSubscription(data: AsaasSubscriptionData): Promise<{ id: string; status: string; value: number; nextDueDate: string }> {
    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSubscription(id: string, data: Partial<AsaasSubscriptionData>): Promise<{ id: string; value: number; status: string }> {
    return this.request(`/subscriptions/${id}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelSubscription(id: string): Promise<{ id: string; deleted: boolean }> {
    return this.request(`/subscriptions/${id}`, {
      method: 'DELETE',
    });
  }

  async getSubscriptionPayments(subscriptionId: string): Promise<{ data: Array<{ id: string; status: string; value: number; dueDate: string; invoiceUrl?: string; bankSlipUrl?: string }> }> {
    return this.request(`/subscriptions/${subscriptionId}/payments`, {
      method: 'GET',
    });
  }

  // Payments / Cobranças Avulsas
  async createPayment(data: AsaasOneTimePaymentData): Promise<{
    id: string;
    status: string;
    value: number;
    netValue?: number;
    dueDate: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
  }> {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPaymentQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string; expirationDate: string }> {
    return this.request(`/payments/${paymentId}/pixQrCode`, {
      method: 'GET',
    });
  }
}
