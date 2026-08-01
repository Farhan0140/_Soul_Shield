import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PrimaryButton } from '@/components/ui/primary-button';
import { TextField } from '@/components/ui/text-field';
import { useThemeColor } from '@/hooks/use-theme-color';

export const SWATCHES = [
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#EAB308',
  '#84CC16',
  '#22C55E',
  '#14B8A6',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#A855F7',
  '#EC4899',
];

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
  const [color, setColor] = useState(initialColor ?? SWATCHES[0]);
  const border = useThemeColor({}, 'border');

  const isValid = name.trim().length > 0;

  return (
    <View style={styles.container}>
      <TextField label="Name" value={name} onChangeText={setName} placeholder="e.g. Ibadah" />

      <View style={styles.field}>
        <ThemedText type="defaultSemiBold">Color</ThemedText>
        <View style={styles.swatchGrid}>
          {SWATCHES.map((swatch) => {
            const active = swatch === color;
            return (
              // TODO this button is for selecting this swatch as the category color
              <Pressable
                key={swatch}
                onPress={() => setColor(swatch)}
                style={[
                  styles.swatch,
                  { backgroundColor: swatch, borderColor: active ? border : 'transparent' },
                ]}>
                {active ? <IconSymbol name="checkmark" size={16} color="#fff" /> : null}
              </Pressable>
            );
          })}
        </View>
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
  swatchGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#D0342C', fontSize: 14 },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1 },
});
