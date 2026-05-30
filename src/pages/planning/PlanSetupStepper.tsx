export interface SetupStep {
  id: string;
  label: string;
  /** Label override shown when this step is the active CTA */
  activeLabel?: string;
  complete: boolean;
  /** Whether this step acts as the primary CTA when active */
  isCta: boolean;
  /**
   * When true, the step remains a clickable CTA even after completion.
   * Use for repeatable actions (e.g. re-export / hand off).
   */
  persistCta?: boolean;
  onClick?: () => void | Promise<void>;
  disabled?: boolean;
  disabledReason?: string | null;
}
