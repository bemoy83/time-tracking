/**
 * BreadcrumbNav component.
 * Shared HomeIcon back button + breadcrumb segments pattern.
 * Used by TaskDetailHeader and ProjectDetail.
 */

import { ReactNode } from 'react';
import { HomeIcon } from './icons';

export interface BreadcrumbSegment {
  label: string;
  icon?: ReactNode;
  onClick?: () => void;
}

interface BreadcrumbNavProps {
  onBack: () => void;
  segments: BreadcrumbSegment[];
  /** Optional trailing element (e.g. "+ Add to project" link) */
  trailing?: ReactNode;
}

export function BreadcrumbNav({ onBack, segments, trailing }: BreadcrumbNavProps) {
  return (
    <nav className="breadcrumb-nav">
      <button className="breadcrumb-nav__back" onClick={onBack}>
        <HomeIcon className="breadcrumb-nav__back-icon" />
      </button>
      {segments.map((seg, i) => (
        <span key={i} className="breadcrumb-nav__item">
          <span className="breadcrumb-nav__sep">›</span>
          {seg.onClick ? (
            <button className="breadcrumb-nav__segment" onClick={seg.onClick}>
              {seg.icon}
              {seg.label}
            </button>
          ) : (
            <span className="breadcrumb-nav__segment breadcrumb-nav__segment--static">
              {seg.icon}
              {seg.label}
            </span>
          )}
        </span>
      ))}
      {trailing && (
        <>
          <span className="breadcrumb-nav__sep">›</span>
          {trailing}
        </>
      )}
    </nav>
  );
}
