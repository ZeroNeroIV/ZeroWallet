import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { CalculatorModal } from './CalculatorModal';
import { lightHaptic } from '../../services/haptics/hapticFeedback';

interface AmountInputProps {
  value: string;
  onChangeText: (text: string) => void;
  label?: string;
  error?: string;
  currency?: string;
  placeholder?: string;
  editable?: boolean;
  enableCalculator?: boolean;
}

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChangeText,
  label = 'Amount',
  error,
  currency = '$',
  placeholder = '0.00',
  editable = true,
  enableCalculator = false,
}) => {
  const [showCalculator, setShowCalculator] = useState(false);
  const formatAmount = (text: string) => {
    // Remove non-numeric characters except decimal point
    let cleaned = text.replace(/[^0-9.]/g, '');

    // Ensure only one decimal point
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }

    // Limit to 3 decimal places
    if (parts.length === 2 && parts[1].length > 3) {
      cleaned = parts[0] + '.' + parts[1].slice(0, 3);
    }

    return cleaned;
  };

  const handleChangeText = (text: string) => {
    const formatted = formatAmount(text);
    onChangeText(formatted);
  };

  const handleCalculatorOpen = () => {
    lightHaptic();
    setShowCalculator(true);
  };

  const handleCalculatorConfirm = (calculatedValue: string) => {
    onChangeText(calculatedValue);
    setShowCalculator(false);
  };

  const handleCalculatorCancel = () => {
    setShowCalculator(false);
  };

  const displayValue = value ? `${currency}${value}` : '';

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputContainer, error && styles.inputContainerError]}>
        <Text style={styles.currencySymbol}>{currency}</Text>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.neutral.gray400}
          keyboardType="decimal-pad"
          returnKeyType="done"
          editable={editable}
        />
        {enableCalculator && (
          <TouchableOpacity
            onPress={handleCalculatorOpen}
            style={styles.calculatorButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name="calculator"
              size={24}
              color={colors.primary.main}
            />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      {enableCalculator && (
        <CalculatorModal
          visible={showCalculator}
          initialValue={value}
          onConfirm={handleCalculatorConfirm}
          onCancel={handleCalculatorCancel}
          currency={currency}
        />
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderWidth: 1,
    borderColor: colors.neutral.gray300,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  inputContainerError: {
    borderColor: colors.semantic.error,
  },
  currencySymbol: {
    ...typography.h2,
    color: colors.neutral.gray700,
    marginRight: spacing.xs,
  },
  input: {
    ...typography.h2,
    flex: 1,
    color: colors.neutral.gray900,
    padding: 0,
  },
  error: {
    ...typography.caption,
    color: colors.semantic.error,
    marginTop: spacing.xs,
  },
  calculatorButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});
