/**
 * Definições e limites de cotas de armazenamento para Edge Functions (Backblaze B2).
 * Espelha a SSOT de src/utils/subscriptionPricing.ts
 */

export interface PlanStorageQuota {
  maxFileSizeMb: number;
  totalStorageMb: number;
  maxFileSizeBytes: number;
  totalStorageBytes: number;
}

export const PLAN_STORAGE_QUOTAS: Record<string, PlanStorageQuota> = {
  trial: {
    maxFileSizeMb: 5,
    totalStorageMb: 500,
    maxFileSizeBytes: 5 * 1024 * 1024,
    totalStorageBytes: 500 * 1024 * 1024,
  },
  prof_basico: {
    maxFileSizeMb: 10,
    totalStorageMb: 2048,
    maxFileSizeBytes: 10 * 1024 * 1024,
    totalStorageBytes: 2048 * 1024 * 1024,
  },
  prof_medio: {
    maxFileSizeMb: 15,
    totalStorageMb: 5120,
    maxFileSizeBytes: 15 * 1024 * 1024,
    totalStorageBytes: 5120 * 1024 * 1024,
  },
  prof_top: {
    maxFileSizeMb: 20,
    totalStorageMb: 15360,
    maxFileSizeBytes: 20 * 1024 * 1024,
    totalStorageBytes: 15360 * 1024 * 1024,
  },
  clinica_basico: {
    maxFileSizeMb: 25,
    totalStorageMb: 25600,
    maxFileSizeBytes: 25 * 1024 * 1024,
    totalStorageBytes: 25600 * 1024 * 1024,
  },
  clinica_medio: {
    maxFileSizeMb: 30,
    totalStorageMb: 51200,
    maxFileSizeBytes: 30 * 1024 * 1024,
    totalStorageBytes: 51200 * 1024 * 1024,
  },
  clinica_top: {
    maxFileSizeMb: 40,
    totalStorageMb: 102400,
    maxFileSizeBytes: 40 * 1024 * 1024,
    totalStorageBytes: 102400 * 1024 * 1024,
  },
  solo: {
    maxFileSizeMb: 15,
    totalStorageMb: 5120,
    maxFileSizeBytes: 15 * 1024 * 1024,
    totalStorageBytes: 5120 * 1024 * 1024,
  },
  clinic: {
    maxFileSizeMb: 25,
    totalStorageMb: 25600,
    maxFileSizeBytes: 25 * 1024 * 1024,
    totalStorageBytes: 25600 * 1024 * 1024,
  },
  enterprise: {
    maxFileSizeMb: 40,
    totalStorageMb: 102400,
    maxFileSizeBytes: 40 * 1024 * 1024,
    totalStorageBytes: 102400 * 1024 * 1024,
  },
};

export function getPlanStorageQuota(planType?: string | null, isTrial = false): PlanStorageQuota {
  if (isTrial) {
    return PLAN_STORAGE_QUOTAS.trial;
  }
  const normalized = (planType || "").trim().toLowerCase().replace("-", "_");
  if (normalized in PLAN_STORAGE_QUOTAS) {
    return PLAN_STORAGE_QUOTAS[normalized];
  }
  return PLAN_STORAGE_QUOTAS.prof_basico;
}
