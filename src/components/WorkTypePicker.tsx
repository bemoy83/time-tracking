/**
 * WorkTypePicker — reusable searchable combobox for selecting a WorkType.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { WorkType } from '../lib/types';
import { formatWorkTypeWithUnit, resolveWorkUnitLabel } from '../lib/types';
import { useWorkUnitStore } from '../lib/stores/work-unit-store';

interface WorkTypePickerProps {
  workTypes: WorkType[];
  selectedId: string | null;
  onChange: (id: string | null) => void;
  emptyMessage?: string;
  placeholder?: string;
  showRate?: boolean;
  className?: string;
  showLabel?: boolean;
  inputClassName?: string;
  disabled?: boolean;
}

interface PickerOption {
  id: string | null;
  label: string;
}

const SEARCH_EMPTY_MESSAGE = 'No matching work types.';

function getWorkTypeLabel(workType: WorkType): string {
  return formatWorkTypeWithUnit(workType.title, workType.workUnit);
}

export function WorkTypePicker({
  workTypes,
  selectedId,
  onChange,
  emptyMessage = 'No work types yet.',
  placeholder = 'None',
  showRate = false,
  className,
  showLabel = true,
  inputClassName,
  disabled = false,
}: WorkTypePickerProps) {
  useWorkUnitStore();

  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const selectedWorkType = selectedId
    ? workTypes.find((wt) => wt.id === selectedId) ?? null
    : null;
  const committedLabel = selectedWorkType ? getWorkTypeLabel(selectedWorkType) : '';
  const isDisabled = disabled || workTypes.length === 0;
  const canClearSelection = placeholder.trim().length > 0;
  const filterValue = isOpen && search !== committedLabel ? search.trim().toLowerCase() : '';
  const filteredWorkTypes = filterValue
    ? workTypes.filter((wt) => getWorkTypeLabel(wt).toLowerCase().includes(filterValue))
    : workTypes;

  const options: PickerOption[] = [
    ...(canClearSelection ? [{ id: null, label: placeholder }] : []),
    ...filteredWorkTypes.map((wt) => ({
      id: wt.id,
      label: getWorkTypeLabel(wt),
    })),
  ];

  useEffect(() => {
    setSearch(committedLabel);
  }, [committedLabel]);

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
      return;
    }

    if (options.length === 0) {
      setActiveIndex(-1);
      return;
    }

    const selectedIndex = options.findIndex((option) => option.id === selectedId);
    if (selectedIndex >= 0) {
      setActiveIndex(selectedIndex);
      return;
    }

    if (filterValue && canClearSelection && options.length > 1) {
      setActiveIndex(1);
      return;
    }

    setActiveIndex(0);
  }, [canClearSelection, filterValue, isOpen, placeholder, search, selectedId, workTypes]);

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current?.contains(event.target as Node)) return;
      setIsOpen(false);
      setSearch(committedLabel);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [committedLabel, isOpen]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;

    const activeOption = document.getElementById(`${listboxId}-option-${activeIndex}`);
    if (typeof activeOption?.scrollIntoView === 'function') {
      activeOption.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex, isOpen, listboxId]);

  const activeDescendant =
    isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  const selectOption = (optionId: string | null) => {
    const nextWorkType = optionId
      ? workTypes.find((wt) => wt.id === optionId) ?? null
      : null;

    onChange(optionId);
    setSearch(nextWorkType ? getWorkTypeLabel(nextWorkType) : '');
    closeList();
  };

  const openList = () => {
    if (isDisabled) return;
    setIsOpen(true);
  };

  const closeList = () => {
    setIsOpen(false);
    setActiveIndex(-1);
  };

  return (
    <div className={`work-type-picker${className ? ` ${className}` : ''}`} ref={wrapperRef}>
      {showLabel && <label className="entry-modal__label">Work Type</label>}
      <div className="work-type-picker__control">
        <input
          className={`input work-type-picker__input${inputClassName ? ` ${inputClassName}` : ''}`}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!isDisabled && isOpen}
          aria-controls={!isDisabled && isOpen ? listboxId : undefined}
          aria-activedescendant={activeDescendant}
          aria-label="Work Type"
          autoComplete="off"
          disabled={isDisabled}
          placeholder={selectedId == null ? placeholder : undefined}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!isOpen) openList();
          }}
          onFocus={openList}
          onClick={openList}
          onBlur={() => {
            window.setTimeout(() => {
              if (wrapperRef.current?.contains(document.activeElement)) return;
              closeList();
              setSearch(committedLabel);
            }, 0);
          }}
          onKeyDown={(e) => {
            if (isDisabled) return;

            if (e.key === 'ArrowDown') {
              e.preventDefault();
              if (!isOpen) {
                openList();
                return;
              }
              if (options.length === 0) return;
              setActiveIndex((current) => (current < options.length - 1 ? current + 1 : 0));
              return;
            }

            if (e.key === 'ArrowUp') {
              e.preventDefault();
              if (!isOpen) {
                openList();
                return;
              }
              if (options.length === 0) return;
              setActiveIndex((current) => (current > 0 ? current - 1 : options.length - 1));
              return;
            }

            if (e.key === 'Enter') {
              if (!isOpen) {
                openList();
                return;
              }
              if (activeIndex < 0 || activeIndex >= options.length) return;
              e.preventDefault();
              selectOption(options[activeIndex].id);
              return;
            }

            if (e.key === 'Escape' && isOpen) {
              e.preventDefault();
              e.stopPropagation();
              closeList();
              setSearch(committedLabel);
              return;
            }

            if (e.key === 'Tab' && isOpen) {
              closeList();
              setSearch(committedLabel);
            }
          }}
        />

        {!isDisabled && isOpen && (
          <div
            id={listboxId}
            className="work-type-picker__listbox"
            role="listbox"
            aria-label="Work Types"
          >
            {options.length === 0 ? (
              <div className="work-type-picker__empty">{SEARCH_EMPTY_MESSAGE}</div>
            ) : (
              options.map((option, index) => {
                const isSelected = option.id === selectedId;
                const isActive = index === activeIndex;

                return (
                  <div
                    key={option.id ?? '__empty__'}
                    id={`${listboxId}-option-${index}`}
                    className={`work-type-picker__option${isSelected ? ' work-type-picker__option--selected' : ''}${isActive ? ' work-type-picker__option--active' : ''}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => selectOption(option.id)}
                  >
                    {option.label}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
      {workTypes.length === 0 && showLabel && emptyMessage ? (
        <div className="task-work-quantity__hint">{emptyMessage}</div>
      ) : null}
      {showRate && selectedWorkType && (
        <div className="task-work-quantity__hint">
          Assembly: {selectedWorkType.assemblyRate} · Dismantle: {selectedWorkType.dismantleRate} {resolveWorkUnitLabel(selectedWorkType.workUnit)}/person-hr
        </div>
      )}
    </div>
  );
}
