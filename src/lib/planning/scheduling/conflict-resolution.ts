/**
 * Conflict resolution suggestions for over-allocated or over-crewed days.
 */

import type { CapacitySummary } from './capacity';

export interface CrewSuggestion {
  date: string;
  currentCrew: number;
  suggestedCrew: number;
  additionalCrew: number;
}

export interface OvertimeSuggestion {
  date: string;
  deficitHours: number;
  extendMinutes: number;
  currentCrew: number;
}

export interface ConflictSuggestions {
  crewSuggestions: CrewSuggestion[];
  overtimeSuggestions: OvertimeSuggestion[];
  hasConflicts: boolean;
}

/**
 * Generate conflict resolution suggestions from capacity summary.
 *
 * - "Solve for crew": For over-allocated days, suggest increasing crew size
 *   so available person-hours >= required person-hours.
 * - "Solve for overtime": For over-allocated days, suggest extending work hours
 *   based on deficit / available crew.
 */
export function generateConflictSuggestions(capacity: CapacitySummary): ConflictSuggestions {
  const crewSuggestions: CrewSuggestion[] = [];
  const overtimeSuggestions: OvertimeSuggestion[] = [];

  for (const day of capacity.days) {
    if (!day.isOverAllocated || !day.isWorkDay) continue;

    const deficit = day.requiredPersonHours - day.availablePersonHours;
    if (deficit <= 0) continue;

    // Solve for crew: how many additional crew needed?
    // availablePersonHours = accessHours * crewSize
    // We need: accessHours * newCrew >= requiredPersonHours
    // accessHours = availablePersonHours / currentCrew (when currentCrew > 0)
    const currentCrew = day.availableCrew;
    if (currentCrew > 0) {
      const accessHours = day.availablePersonHours / currentCrew;
      if (accessHours > 0) {
        const needed = Math.ceil(day.requiredPersonHours / accessHours);
        const additional = needed - currentCrew;
        if (additional > 0) {
          crewSuggestions.push({
            date: day.date,
            currentCrew,
            suggestedCrew: needed,
            additionalCrew: additional,
          });
        }
      }
    }

    // Solve for overtime: how many extra hours per worker?
    const crewForOvertime = currentCrew > 0 ? currentCrew : 1;
    const extendHoursRaw = deficit / crewForOvertime;
    const extendMinutes = Math.ceil(extendHoursRaw * 60 / 30) * 30; // Round up to 30 min
    overtimeSuggestions.push({
      date: day.date,
      deficitHours: deficit,
      extendMinutes,
      currentCrew: crewForOvertime,
    });
  }

  return {
    crewSuggestions,
    overtimeSuggestions,
    hasConflicts: crewSuggestions.length > 0 || overtimeSuggestions.length > 0,
  };
}

/**
 * Format a suggestion for display.
 */
export function formatCrewSuggestionSummary(suggestions: CrewSuggestion[]): string {
  if (suggestions.length === 0) return '';
  const parts = suggestions.map((s) => {
    const dayLabel = new Date(`${s.date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    return `+${s.additionalCrew} crew on ${dayLabel}`;
  });
  return parts.join(', ');
}

export function formatOvertimeSuggestionSummary(suggestions: OvertimeSuggestion[]): string {
  if (suggestions.length === 0) return '';
  const parts = suggestions.map((s) => {
    const dayLabel = new Date(`${s.date}T00:00:00`).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const hours = Math.floor(s.extendMinutes / 60);
    const mins = s.extendMinutes % 60;
    const timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    return `Extend ${dayLabel} by ${timeStr}`;
  });
  return parts.join(', ');
}
