import type { RuntimeDebugEvent } from "@/lib/runtime-debug";
import type { TelemetryBreadcrumb } from "@/lib/telemetry-breadcrumbs";

export interface WhatsAppBugContext {
  source?: string;
  leadName?: string;
  userName?: string;
  clinicName?: string;
  phone?: string;
  message?: string;
  imageUrl?: string;
  [key: string]: unknown;
}

export interface GroupedIssue {
  fingerprint: string;
  scope: string;
  message: string;
  stack?: string;
  type: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  lastTimeString: string;
  affectedUsers: Set<string>;
  affectedClinics: Set<string>;
  devices: Set<string>;
  latestEvent: RuntimeDebugEvent;
  breadcrumbs: TelemetryBreadcrumb[];
}

export interface ErrorEnvironmentInfo {
  viewport?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  deviceType?: "mobile" | "desktop";
  os?: string;
  userAgent?: string;
  pathname?: string;
}
