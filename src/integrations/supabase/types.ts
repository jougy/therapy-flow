/**
 * Supabase Types Modularized Barrel
 *
 * Re-exporta todos os contratos e tipos modularizados de ./types/
 * Preserva compatibilidade total com imports legados.
 */

export type {
  Json,
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  Enums,
  CompositeTypes,
} from "./types/database";

export { Constants } from "./types/database";

export * from "./types/tables";
export * from "./types/enums";
export * from "./types/functions";
