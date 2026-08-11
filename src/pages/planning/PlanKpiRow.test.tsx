/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckIcon } from '../../components/icons';
import { PlanKpiRow } from './PlanKpiRow';

describe('PlanKpiRow', () => {
  it('renders constrained KPI icon and ring hooks for populated progress metrics', () => {
    const { container } = render(
      <PlanKpiRow
        metrics={[
          {
            value: '0%',
            label: 'Completion',
            icon: <CheckIcon />,
            iconVariant: 'done',
            ring: { ratio: 0, isComplete: false },
          },
          {
            value: '15',
            label: 'Planned items',
            icon: <CheckIcon />,
            iconVariant: 'tasks',
          },
        ]}
      />,
    );

    expect(container.querySelector('.planning-view__kpi-row')).toBeTruthy();
    expect(container.querySelectorAll('.planning-view__kpi-card')).toHaveLength(2);
    expect(container.querySelector('.planning-view__kpi-card-ico svg')).toBeTruthy();
    expect(screen.getByRole('img', { name: '0% scheduled' }).classList.contains('planning-view__kpi-ring')).toBe(true);
  });
});
