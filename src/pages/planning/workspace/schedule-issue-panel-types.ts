import type { AutoScheduleUnresolvedReason } from '../../../lib/planning/scheduling/auto-schedule';
import type { BuildPhase } from '../../../lib/types';

export type SidebarPane = 'metrics' | 'issues';

export type ScheduleIssueSeverity = 'critical' | 'warning' | 'info';

export type ScheduleIssueKind =
  | 'capacity'
  | 'assistant-unresolved'
  | 'assistant-stale'
  | 'unscheduled'
  | 'overstaffed';

export type ScheduleIssueScope = 'plan' | 'item';

export type ScheduleIssueCategory = 'blocking' | 'adjustment' | 'optimization';

export type ScheduleAssistantStatus = 'ready' | 'stale' | 'needs-review';

export interface ScheduleAssistantBestNextMove {
  title: string;
  rationale: string;
  impact?: string;
}

export interface ScheduleIssueItem {
  id: string;
  kind: ScheduleIssueKind;
  severity: ScheduleIssueSeverity;
  label: string;
  assistantPriority?: number;
  impact?: string;
  sharedConstraintKey?: string;
  scope?: ScheduleIssueScope;
  category?: ScheduleIssueCategory;
  detail?: string;
  facts?: string[];
  lineItemId?: string;
  phase?: BuildPhase;
  issueKey?: string;
  unresolvedReason?: AutoScheduleUnresolvedReason;
  requiredPH?: number;
  assignedPH?: number;
}

export interface ScheduleIssuePanelState {
  planId: string;
  isStale: boolean;
  unresolvedCount: number;
  issues: ScheduleIssueItem[];
  assistantStatus?: ScheduleAssistantStatus;
  assistantSummary?: string;
  assistantBestNextMove?: ScheduleAssistantBestNextMove | null;
  assistantInsights?: string[];
  activeIssueKey: string | null;
  canRunAssistant: boolean;
  canClearAll: boolean;
}

export interface ScheduleIssuePanelActions {
  selectIssue: (issueKey: string) => void;
  focusNext: () => void;
  focusPrev: () => void;
  runAssistant: () => Promise<void>;
  clearAllSchedules: () => void;
  openCalendar: () => void;
}

export interface ScheduleIssuePanelPayload {
  state: ScheduleIssuePanelState;
  actions: ScheduleIssuePanelActions;
}
