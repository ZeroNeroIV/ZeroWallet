import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { Button } from './Button';
import { lightHaptic } from '../../services/haptics/hapticFeedback';
import {
  evaluateExpression,
  formatExpression,
  isValidCalculatorInput,
  isCompleteExpression,
} from '../../utils/calculator';

interface CalculatorModalProps {
  visible: boolean;
  initialValue?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
  currency?: string;
}

type CalculatorButton = {
  label: string;
  value: string;
  type: 'number' | 'operator' | 'function';
  icon?: string;
};

export const CalculatorModal: React.FC<CalculatorModalProps> = ({
  visible,
  initialValue = '',
  onConfirm,
  onCancel,
  currency = '$',
}) => {
  const themeColors = useThemeColors();
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState<number | null>(null);
  const [error, setError] = useState('');

  // Initialize expression when modal opens
  useEffect(() => {
    if (visible) {
      const cleanValue = initialValue.replace(/[^0-9.]/g, '');
      setExpression(cleanValue || '');
      setError('');
      if (cleanValue) {
        const evaluated = evaluateExpression(cleanValue);
        setResult(evaluated);
      } else {
        setResult(null);
      }
    }
  }, [visible, initialValue]);

  // Update result whenever expression changes
  useEffect(() => {
    if (expression) {
      const evaluated = evaluateExpression(expression);
      setResult(evaluated);

      // Clear error when user continues typing
      if (error) {
        setError('');
      }
    } else {
      setResult(null);
    }
  }, [expression]);

  const handleButtonPress = (button: CalculatorButton) => {
    lightHaptic();

    if (button.type === 'function') {
      switch (button.value) {
        case 'clear':
          setExpression('');
          setResult(null);
          setError('');
          break;
        case 'backspace':
          setExpression((prev) => prev.slice(0, -1));
          break;
        case 'equals':
          // Calculate final result
          if (isCompleteExpression(expression)) {
            const finalResult = evaluateExpression(expression);
            if (finalResult !== null) {
              setExpression(finalResult.toString());
              setResult(finalResult);
            }
          }
          break;
      }
    } else {
      // Add number or operator
      if (isValidCalculatorInput(button.value, expression)) {
        setExpression((prev) => prev + button.value);
      }
    }
  };

  const handleConfirm = () => {
    if (!expression) {
      setError('Please enter an amount');
      return;
    }

    const finalResult = result !== null ? result : evaluateExpression(expression);

    if (finalResult === null) {
      setError('Invalid expression');
      return;
    }

    if (finalResult <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    // Format to 2 decimal places
    const formattedValue = finalResult.toFixed(3);
    onConfirm(formattedValue);
  };

  const handleCancel = () => {
    setExpression('');
    setResult(null);
    setError('');
    onCancel();
  };

  // Calculator button layout
  const calculatorButtons: CalculatorButton[][] = [
    [
      { label: '7', value: '7', type: 'number' },
      { label: '8', value: '8', type: 'number' },
      { label: '9', value: '9', type: 'number' },
      { label: '÷', value: '÷', type: 'operator' },
    ],
    [
      { label: '4', value: '4', type: 'number' },
      { label: '5', value: '5', type: 'number' },
      { label: '6', value: '6', type: 'number' },
      { label: '×', value: '×', type: 'operator' },
    ],
    [
      { label: '1', value: '1', type: 'number' },
      { label: '2', value: '2', type: 'number' },
      { label: '3', value: '3', type: 'number' },
      { label: '-', value: '-', type: 'operator' },
    ],
    [
      { label: 'C', value: 'clear', type: 'function' },
      { label: '0', value: '0', type: 'number' },
      { label: '.', value: '.', type: 'number' },
      { label: '+', value: '+', type: 'operator' },
    ],
    [
      { label: '⌫', value: 'backspace', type: 'function', icon: 'backspace-outline' },
      { label: '=', value: 'equals', type: 'function' },
    ],
  ];

  const getButtonStyle = (button: CalculatorButton) => {
    if (button.type === 'operator') {
      return [styles.button, styles.operatorButton];
    }
    if (button.type === 'function') {
      if (button.value === 'equals') {
        return [styles.button, styles.equalsButton, { flex: 2 }];
      }
      return [styles.button, styles.functionButton];
    }
    return styles.button;
  };

  const getButtonTextStyle = (button: CalculatorButton) => {
    if (button.type === 'operator') {
      return [styles.buttonText, styles.operatorButtonText];
    }
    if (button.type === 'function') {
      if (button.value === 'equals') {
        return [styles.buttonText, styles.equalsButtonText];
      }
      return [styles.buttonText, styles.functionButtonText];
    }
    return styles.buttonText;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancel}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: themeColors.surface }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              Calculator
            </Text>
            <TouchableOpacity onPress={handleCancel}>
              <MaterialCommunityIcons
                name="close"
                size={24}
                color={themeColors.text}
              />
            </TouchableOpacity>
          </View>

          {/* Display Section */}
          <View style={[styles.displayContainer, { backgroundColor: themeColors.background }]}>
            <View style={styles.expressionContainer}>
              <Text style={[styles.expressionText, { color: themeColors.textSecondary }]}>
                {expression ? formatExpression(expression) : '0'}
              </Text>
            </View>
            <View style={styles.resultContainer}>
              <Text style={[styles.currencySymbol, { color: themeColors.textSecondary }]}>
                {currency}
              </Text>
              <Text style={[styles.resultText, { color: themeColors.text }]}>
                {result !== null ? result.toFixed(3) : '0.000'}
              </Text>
            </View>
          </View>

          {/* Error Message */}
          {error ? (
            <View style={styles.errorContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={16}
                color={colors.semantic.error}
              />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Calculator Numpad */}
          <View style={styles.numpadContainer}>
            {calculatorButtons.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.buttonRow}>
                {row.map((button, buttonIndex) => (
                  <TouchableOpacity
                    key={buttonIndex}
                    style={getButtonStyle(button)}
                    onPress={() => handleButtonPress(button)}
                    activeOpacity={0.7}
                  >
                    {button.icon ? (
                      <MaterialCommunityIcons
                        name={button.icon as any}
                        size={24}
                        color={
                          button.type === 'function'
                            ? colors.primary.main
                            : themeColors.text
                        }
                      />
                    ) : (
                      <Text style={getButtonTextStyle(button)}>{button.label}</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          {/* Footer Buttons */}
          <View style={styles.footerButtons}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={handleCancel}
              style={styles.footerButton}
            />
            <Button
              title="Confirm"
              variant="primary"
              onPress={handleConfirm}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    minHeight: 500,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    ...typography.h3,
  },
  displayContainer: {
    borderRadius: 12,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  expressionContainer: {
    minHeight: 30,
    marginBottom: spacing.sm,
  },
  expressionText: {
    ...typography.body,
    fontSize: 16,
    textAlign: 'right',
  },
  resultContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-end',
  },
  currencySymbol: {
    ...typography.h2,
    fontSize: 24,
    marginRight: spacing.xs,
  },
  resultText: {
    ...typography.h1,
    fontSize: 36,
    fontWeight: '700',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  errorText: {
    ...typography.caption,
    color: colors.semantic.error,
  },
  numpadContainer: {
    marginBottom: spacing.lg,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  button: {
    flex: 1,
    aspectRatio: 1.5,
    backgroundColor: colors.neutral.gray100,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  operatorButton: {
    backgroundColor: colors.primary.light,
  },
  functionButton: {
    backgroundColor: colors.neutral.gray200,
  },
  equalsButton: {
    backgroundColor: colors.primary.main,
  },
  buttonText: {
    ...typography.h3,
    fontSize: 24,
    fontWeight: '600',
    color: colors.neutral.gray900,
  },
  operatorButtonText: {
    color: colors.primary.main,
    fontWeight: '700',
  },
  functionButtonText: {
    color: colors.primary.main,
    fontWeight: '600',
  },
  equalsButtonText: {
    color: colors.neutral.white,
    fontWeight: '700',
  },
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  footerButton: {
    flex: 1,
  },
});
