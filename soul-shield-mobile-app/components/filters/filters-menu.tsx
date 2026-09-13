import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FilterChip } from '@/components/filters/filter-chip';
import type { SourceFilter } from '@/components/filters/source-filter';
import type { StatusFilter } from '@/components/filters/status-tabs';
import type { TaskTypeFilter } from '@/components/filters/task-type-filter';
import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

const STATUS_OPTIONS: { key: StatusFilter; label: string; icon: IconSymbolName }[] = [
  { key: 'all', label: 'All', icon: 'square.grid.2x2' },
  { key: 'pending', label: 'Pending', icon: 'clock' },
  { key: 'completed', label: 'Completed', icon: 'checkmark.circle.fill' },
  { key: 'missed', label: 'Missed', icon: 'xmark.circle.fill' },
];

const TYPE_OPTIONS: { key: TaskTypeFilter; label: string; icon: IconSymbolName }[] = [
  { key: 'all', label: 'All', icon: 'square.grid.2x2' },
  { key: 'normal', label: 'Normal', icon: 'checkmark.square' },
  { key: 'counter', label: 'Counter', icon: 'repeat' },
  { key: 'timer', label: 'Timer', icon: 'timer' },
];

const SOURCE_OPTIONS: { key: SourceFilter; label: string; icon: IconSymbolName }[] = [
  { key: 'all', label: 'All', icon: 'square.grid.2x2' },
  { key: 'fixed', label: 'Fixed', icon: 'shield.fill' },
  { key: 'mine', label: 'My Tasks', icon: 'person.fill' },
];

interface FiltersMenuProps {
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  taskType: TaskTypeFilter;
  onTaskTypeChange: (value: TaskTypeFilter) => void;
  source: SourceFilter;
  onSourceChange: (value: SourceFilter) => void;
}

/** The entire Status/Type/Source filter block collapsed into one trigger:
 * a single row that opens a bottom sheet holding all three filter groups,
 * instead of the filter groups permanently taking up their own space on the
 * screen (whether as stacked chip rows or as three side-by-side dropdown
 * triggers). The trigger's badge count and the sheet's "Clear all" are the
 * only things that need to reflect state while collapsed. */
export function FiltersMenu({
  status,
  onStatusChange,
  taskType,
  onTaskTypeChange,
  source,
  onSourceChange,
}: FiltersMenuProps) {
  const [open, setOpen] = useState(false);
  const tint = useThemeColor({}, 'tint');
  const card = useThemeColor({}, 'card');
  const border = useThemeColor({}, 'border');
  const muted = useThemeColor({}, 'muted');
  const insets = useSafeAreaInsets();

  const activeCount = [status !== 'all', taskType !== 'all', source !== 'all'].filter(Boolean).length;
  const hasActive = activeCount > 0;

  const clearAll = () => {
    onStatusChange('all');
    onTaskTypeChange('all');
    onSourceChange('all');
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.trigger,
          {
            backgroundColor: card,
            borderColor: hasActive ? tint : border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}>
        <IconSymbol name="line.3.horizontal.decrease" size={16} color={hasActive ? tint : muted} />
        <ThemedText type="defaultSemiBold" style={[styles.triggerLabel, hasActive && { color: tint }]}>
          Filters{hasActive ? ` (${activeCount})` : ''}
        </ThemedText>
        <IconSymbol name="chevron.down" size={16} color={hasActive ? tint : muted} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[styles.sheet, { backgroundColor: card, paddingBottom: insets.bottom + 20 }]}>
            <View style={[styles.handle, { backgroundColor: border }]} />
            <View style={styles.sheetHeader}>
              <ThemedText type="subtitle">Filters</ThemedText>
              {hasActive ? (
                <Pressable onPress={clearAll} hitSlop={8}>
                  <ThemedText type="link" style={styles.clearLabel}>
                    Clear all
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={styles.groups}>
              <FilterGroup title="Status" options={STATUS_OPTIONS} value={status} onChange={onStatusChange} />
              <FilterGroup title="Type" options={TYPE_OPTIONS} value={taskType} onChange={onTaskTypeChange} />
              <FilterGroup title="Source" options={SOURCE_OPTIONS} value={source} onChange={onSourceChange} />
            </ScrollView>
            <Pressable
              onPress={() => setOpen(false)}
              style={({ pressed }) => [styles.doneButton, { backgroundColor: tint, opacity: pressed ? 0.85 : 1 }]}>
              <ThemedText type="defaultSemiBold" style={styles.doneLabel}>
                Done
              </ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function FilterGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { key: T; label: string; icon: IconSymbolName }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.group}>
      <ThemedText type="defaultSemiBold" style={styles.groupTitle}>
        {title}
      </ThemedText>
      <View style={styles.chipWrap}>
        {options.map((option) => (
          <FilterChip
            key={option.key}
            label={option.label}
            icon={option.icon}
            active={value === option.key}
            onPress={() => onChange(option.key)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  triggerLabel: { flex: 1, fontSize: 14 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: 'continuous',
    padding: 20,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  clearLabel: { fontSize: 14 },
  groups: { flexGrow: 0 },
  group: { gap: 10, marginBottom: 22 },
  groupTitle: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  doneButton: {
    borderRadius: 14,
    borderCurve: 'continuous',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  doneLabel: { color: '#fff' },
});
