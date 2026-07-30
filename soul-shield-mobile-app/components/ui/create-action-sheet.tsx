import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol, type IconSymbolName } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';

interface CreateActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onCreateTask: () => void;
  onCreateCategory: () => void;
}

export function CreateActionSheet({
  visible,
  onClose,
  onCreateTask,
  onCreateCategory,
}: CreateActionSheetProps) {
  const cardColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Swallow taps inside the sheet so they don't bubble to the backdrop's close handler. */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[styles.sheet, { backgroundColor: cardColor, paddingBottom: insets.bottom + 20 }]}>
          <View style={[styles.handle, { backgroundColor: borderColor }]} />
          <ThemedText type="subtitle" style={styles.title}>
            Create New
          </ThemedText>

          <ActionRow
            icon="checkmark.circle.fill"
            title="Create Task"
            description="Create a new task."
            onPress={onCreateTask}
          />
          <ActionRow
            icon="folder.fill"
            title="Create Category"
            description="Create a new task category."
            onPress={onCreateCategory}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

interface ActionRowProps {
  icon: IconSymbolName;
  title: string;
  description: string;
  onPress: () => void;
}

function ActionRow({ icon, title, description, onPress }: ActionRowProps) {
  const tint = useThemeColor({}, 'tint');
  const mutedColor = useThemeColor({}, 'muted');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${tint}1A` }]}>
        <IconSymbol name={icon} size={24} color={tint} />
      </View>
      <View style={styles.rowText}>
        <ThemedText type="defaultSemiBold">{title}</ThemedText>
        <ThemedText style={[styles.rowDescription, { color: mutedColor }]}>{description}</ThemedText>
      </View>
      <IconSymbol name="chevron.right" size={18} color={mutedColor} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
    gap: 6,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: { marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowDescription: { fontSize: 13 },
});
