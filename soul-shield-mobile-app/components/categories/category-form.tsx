import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ColorPicker } from '@/components/ui/color-picker';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';

const DEFAULT_COLOR = '#4F46E5';

interface CategoryFormProps {
  initialName?: string;
  initialColor?: string;
  submitting?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (input: { name: string; color_hex: string }) => void;
  onCancel: () => void;
}

export function CategoryForm({
  initialName = '',
  initialColor,
  submitting,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: CategoryFormProps) {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor ?? DEFAULT_COLOR);

  const isValid = name.trim().length > 0;

  return (
    <View style={styles.container}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Ibadah" />

      <View style={styles.field}>
        <ColorPicker value={color} onChange={setColor} />
      </View>

      {error ? (
        <ThemedText selectable style={styles.error}>
          {error}
        </ThemedText>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.actionButton}>
          {/* TODO this button is for cancelling out of the category form without saving */}
          <PrimaryButton label="Cancel" variant="secondary" onPress={onCancel} />
        </View>
        <View style={styles.actionButton}>
          {/* TODO this button is for submitting the form to create or update the category (label is "Create Category" or "Save") */}
          <PrimaryButton
            label={submitLabel}
            onPress={() => onSubmit({ name: name.trim(), color_hex: color })}
            loading={submitting}
            disabled={!isValid}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16 },
  field: { gap: 10 },
  error: { color: '#D0342C', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1 },
});
