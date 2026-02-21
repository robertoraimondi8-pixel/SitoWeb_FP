/**
 * WebDateTimePicker - Cross-platform date/time input.
 * Uses native HTML inputs on web, falls back to @react-native-community/datetimepicker on native.
 */
import React from 'react';
import { Platform, View, StyleSheet } from 'react-native';

interface Props {
  value: Date;
  mode: 'date' | 'time';
  onChange: (date: Date) => void;
  minimumDate?: Date;
  accentColor?: string;
}

export default function WebDateTimePicker({ value, mode, onChange, minimumDate, accentColor = '#F5A623' }: Props) {
  if (Platform.OS === 'web') {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      if (!val) return;
      if (mode === 'date') {
        const [y, m, d] = val.split('-').map(Number);
        const next = new Date(value);
        next.setFullYear(y, m - 1, d);
        onChange(next);
      } else {
        const [h, min] = val.split(':').map(Number);
        const next = new Date(value);
        next.setHours(h, min);
        onChange(next);
      }
    };

    const inputValue = mode === 'date'
      ? value.toISOString().slice(0, 10)
      : `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;

    return (
      <View style={st.webWrapper}>
        <input
          type={mode}
          value={inputValue}
          min={minimumDate && mode === 'date' ? minimumDate.toISOString().slice(0, 10) : undefined}
          onChange={handleChange as any}
          style={{
            width: '100%',
            padding: '12px 14px',
            fontSize: '15px',
            fontWeight: 600,
            border: '1px solid #ddd',
            borderRadius: '10px',
            backgroundColor: 'transparent',
            color: 'inherit',
            accentColor,
            outline: 'none',
            cursor: 'pointer',
          }}
        />
      </View>
    );
  }

  // Native: use the standard DateTimePicker
  const DateTimePicker = require('@react-native-community/datetimepicker').default;
  return (
    <DateTimePicker
      value={value}
      mode={mode}
      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
      is24Hour
      minimumDate={minimumDate}
      onChange={(_: unknown, d?: Date) => {
        if (d) onChange(d);
      }}
    />
  );
}

const st = StyleSheet.create({
  webWrapper: { marginVertical: 6 },
});
