import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';

interface DatePickerProps {
  value?: Date | null;
  onChange: (date: Date | null) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  maximumDate?: Date;
  minimumDate?: Date;
  clearable?: boolean;
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  label = 'Date',
  placeholder = 'Select date (optional)',
  error,
  maximumDate,
  minimumDate,
  clearable = true,
}) => {
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value || new Date());

  const formatDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  };

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowPicker(false);
      if (event.type === 'set' && selectedDate) {
        onChange(selectedDate);
      }
    } else {
      if (selectedDate) {
        setTempDate(selectedDate);
      }
    }
  };

  const handleConfirm = () => {
    onChange(tempDate);
    setShowPicker(false);
  };

  const handleCancel = () => {
    setTempDate(value || new Date());
    setShowPicker(false);
  };

  const handleClear = (e: any) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <TouchableOpacity
        style={[styles.picker, error && styles.pickerError]}
        onPress={() => {
          setTempDate(value || new Date());
          setShowPicker(true);
        }}
      >
        <View style={styles.dateContainer}>
          <MaterialCommunityIcons
            name="calendar"
            size={20}
            color={colors.primary.main}
          />
          <Text style={[styles.dateText, !value && styles.placeholderText]}>
            {value ? formatDate(value) : placeholder}
          </Text>
        </View>

        <View style={styles.trailingIcons}>
          {clearable && value && (
            <TouchableOpacity onPress={handleClear} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialCommunityIcons
                name="close-circle"
                size={18}
                color={colors.neutral.gray500}
                style={{ marginRight: 6 }}
              />
            </TouchableOpacity>
          )}
          <MaterialCommunityIcons
            name="chevron-down"
            size={24}
            color={colors.neutral.gray500}
          />
        </View>
      </TouchableOpacity>

      {error && <Text style={styles.error}>{error}</Text>}

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={handleCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Select Date</Text>
                <TouchableOpacity onPress={handleConfirm}>
                  <Text style={styles.confirmButton}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempDate}
                mode="date"
                display="spinner"
                onChange={handleDateChange}
                maximumDate={maximumDate}
                minimumDate={minimumDate}
                textColor={colors.neutral.gray900}
              />
            </View>
          </View>
        </Modal>
      ) : (
        showPicker && (
          <DateTimePicker
            value={value || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
            maximumDate={maximumDate}
            minimumDate={minimumDate}
          />
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    ...typography.body,
    fontWeight: '500',
    color: colors.neutral.gray700,
    marginBottom: spacing.xs,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray300,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  pickerError: {
    borderColor: colors.semantic.error,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  trailingIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    ...typography.body,
    color: colors.neutral.gray900,
    fontWeight: '500',
  },
  placeholderText: {
    color: colors.neutral.gray500,
    fontWeight: '400',
  },
  error: {
    ...typography.caption,
    color: colors.semantic.error,
    marginTop: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: spacing.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.gray200,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.neutral.gray900,
  },
  cancelButton: {
    ...typography.body,
    color: colors.neutral.gray600,
  },
  confirmButton: {
    ...typography.body,
    color: colors.primary.main,
    fontWeight: '600',
  },
});
