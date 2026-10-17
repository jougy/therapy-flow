export type TutorialAnimation = "dance" | "pulse" | "bounce" | "glow";
export type TutorialPlacement = "top" | "bottom" | "left" | "right" | "center";

export type VisualPreviewType =
  | "payment-status"
  | "clock-colors"
  | "recurrence-pill"
  | "keyboard-shortcuts"
  | "list-mode"
  | "status-badge"
  | "pain-scale"
  | "custom-badges"
  | "form-field-mock";

export interface VisualPreviewItem {
  label: string;
  badgeText?: string;
  icon?: string;
  colorClass?: string;
  bgClass?: string;
  borderClass?: string;
  desc?: string;
}

export interface KeyboardShortcutItem {
  keys: string[];
  label: string;
  description?: string;
}

export interface TutorialVisualPreviewConfig {
  type: VisualPreviewType;
  title?: string;
  fieldMockType?: string;
  fieldMockConfig?: {
    label?: string;
    placeholder?: string;
    value?: string;
    options?: string[];
    description?: string;
    color?: string;
    badge?: string;
    columns?: string[];
    isRequired?: boolean;
  };
  items?: VisualPreviewItem[];
  shortcuts?: KeyboardShortcutItem[];
  recurrenceDays?: Array<{ letter: string; active?: boolean; dayName?: string }>;
  activeListMode?: "patients" | "sessions";
}

export interface TutorialLearnMoreAction {
  label: string;
  actionType: "navigate_chapter" | "navigate_help" | "navigate_route";
  targetId?: string; // chapterId or helpId
  targetRoute?: string; // route path
  requiresDemoPatient?: boolean;
}

export interface TutorialStep {
  id: string;
  targetSelector?: string;
  title: string;
  description: string;
  tip?: string;
  actionPrompt?: string; // Prompt when the user should click/interact with the element
  requiresAction?: boolean; // If true, highlights that clicking the element advances the tutorial
  interactive?: boolean; // Enables pointer events for this element specifically
  placement?: TutorialPlacement;
  animation?: TutorialAnimation;
  highlightPadding?: number;
  route?: string; // Associated route path for this step in master journey
  chapterId?: string;
  isDemoNotice?: boolean; // If true, shows a notice that this is a simulated demo patient
  visualPreview?: TutorialVisualPreviewConfig;
  learnMoreAction?: TutorialLearnMoreAction;
  requiredPermission?: string; // e.g. "treasury.manage", "forms.manage", "subaccounts.manage", "patients.manage"
  requiredRole?: string[]; // e.g. ["owner", "admin", "professional"]
  onBeforeStep?: () => void | Promise<void>;
  onAfterStep?: () => void | Promise<void>;
}

export interface TutorialChapter {
  id: string;
  chapterNumber: number;
  title: string;
  shortTitle: string;
  description: string;
  badge: string;
  estimatedMinutes: number;
  route: string;
  iconName: string;
  requiredPermission?: string;
  requiredRole?: string[];
  steps: TutorialStep[];
}

export interface PageTutorialConfig {
  pageId: string;
  title: string;
  description: string;
  badge?: string;
  requiredPermission?: string;
  steps: TutorialStep[];
}

export type ComponentHelpEntry = TutorialStep | TutorialStep[];

export interface HelperItemConfig {
  hidden?: boolean;
  title?: string;
  description?: string;
  tip?: string;
}

export interface HelpersFeatureFlagValue {
  enabled?: boolean;
  helpers?: Record<string, HelperItemConfig>;
}

export interface HelperItemInfo {
  id: string;
  name: string;
  description: string;
  targetSelector?: string;
}

export interface HelperPageGroup {
  id: string;
  title: string;
  route: string;
  iconName: string;
  description: string;
  helpers: HelperItemInfo[];
}

