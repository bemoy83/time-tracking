import { useMemo } from 'react';

interface SequencableTag {
  id: string;
  name: string;
  sequencable: boolean;
}

export function useScheduleSequenceTagIds(
  tags: SequencableTag[],
  storedSequenceTagIds: string[],
): string[] {
  return useMemo(() => {
    const sequencableTags = tags.filter((tag) => tag.sequencable);
    if (sequencableTags.length === 0) return [];

    const sequenceSet = new Set(storedSequenceTagIds);
    const positionMap = new Map(storedSequenceTagIds.map((id, index) => [id, index]));
    const inSequence = sequencableTags
      .filter((tag) => sequenceSet.has(tag.id))
      .sort((left, right) => (positionMap.get(left.id) ?? 0) - (positionMap.get(right.id) ?? 0));
    const notInSequence = sequencableTags
      .filter((tag) => !sequenceSet.has(tag.id))
      .sort((left, right) => left.name.localeCompare(right.name));

    return [...inSequence, ...notInSequence].map((tag) => tag.id);
  }, [tags, storedSequenceTagIds]);
}
