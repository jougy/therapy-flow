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
  cycle: 'MONTHLY' | 'QUARTERLY' | 'SEMIANNUALLY' | 'ANNUALLY';
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
  value?: number;
  totalValue?: number;
  installmentCount?: number;
  installmentValue?: number;
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
  private environment: 'production' | 'sandbox';

  constructor(envOverride?: 'production' | 'sandbox') {
    const defaultEnv = (Deno.env.get('ASAAS_ENV') || 'sandbox').toLowerCase() as 'production' | 'sandbox';
    this.environment = envOverride || (defaultEnv === 'production' ? 'production' : 'sandbox');

    if (this.environment === 'production') {
      this.apiKey = Deno.env.get('ASAAS_API_KEY') || Deno.env.get('ASAAS_PROD_API_KEY') || '';
      this.baseUrl = 'https://api.asaas.com/v3';
    } else {
      this.apiKey = Deno.env.get('ASAAS_SANDBOX_API_KEY') || Deno.env.get('ASAAS_API_KEY_SANDBOX') || '';
      this.baseUrl = 'https://sandbox.asaas.com/api/v3';
    }
  }

  public getEnvironment(): 'production' | 'sandbox' {
    return this.environment;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    if (!this.apiKey) {
      throw new Error(`Chave da API Asaas não configurada para o ambiente [${this.environment}]. Verifique ASAAS_API_KEY / ASAAS_PROD_API_KEY / ASAAS_SANDBOX_API_KEY.`);
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
      let errorMessage = 'Erro na API Asaas';
      if (Array.isArray(json?.errors) && json.errors.length > 0) {
        errorMessage = json.errors.map((e: any) => e.description || e.message || JSON.stringify(e)).join(' | ');
      } else if (json?.message) {
        errorMessage = json.message;
      } else if (json?.error) {
        errorMessage = json.error;
      } else if (response.statusText) {
        errorMessage = response.statusText;
      }
      console.error(`[AsaasClient] Erro HTTP ${response.status} em ${endpoint}:`, errorMessage, json);
      throw new Error(`Asaas (${response.status}): ${errorMessage}`);
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

  async getSubscriptionPayments(subscriptionId: string): Promise<{ data: Array<{ id: string; status: string; value: number; dueDate: string; invoiceUrl?: string; bankSlipUrl?: string; paymentDate?: string; clientPaymentDate?: string }> }> {
    return this.request(`/subscriptions/${subscriptionId}/payments`, {
      method: 'GET',
    });
  }

  // Payments / Cobranças Avulsas
  async getPayment(paymentId: string): Promise<{
    id: string;
    status: string;
    value: number;
    netValue?: number;
    dueDate: string;
    invoiceUrl?: string;
    bankSlipUrl?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
  }> {
    return this.request(`/payments/${paymentId}`, {
      method: 'GET',
    });
  }

  async getCustomerPayments(customerId: string, limit = 10): Promise<{ data: Array<{ id: string; status: string; value: number; dueDate: string; paymentDate?: string; clientPaymentDate?: string }> }> {
    return this.request(`/payments?customer=${customerId}&limit=${limit}`, {
      method: 'GET',
    });
  }

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

  async getPaymentQrCode(paymentId: string): Promise<{ encodedImage: string; payload: string; expirationDate?: string }> {
    return this.request(`/payments/${paymentId}/pixQrCode`, {
      method: 'GET',
    });
  }
}
