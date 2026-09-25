import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
  Platform,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CategoryIcon } from './CategoryIcon';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Transaction, Category } from '../../types/models';
import { lightHaptic, heavyHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { useThemeColors } from '../../hooks/useThemeColors';

interface TransactionItemProps {
  transaction: Transaction;
  category: Category;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  accountCurrency?: string; // Account's base currency
}

export const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  category,
  onPress,
  onEdit,
  onDelete,
  accountCurrency = 'USD',
}) => {
  const swipeableRef = useRef<Swipeable>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  const formatAmount = (amount: number, currency: string, showSign: boolean = false, type?: 'income' | 'expense') => {
    const sign = showSign && type ? (type === 'income' ? '+' : '-') : '';
    if (currency === 'USD') {
      return `${sign}$${amount.toFixed(3)}`;
    }
    return `${sign}${amount.toFixed(3)} ${currency}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
    };
    return date.toLocaleDateString('en-US', options);
  };

  const handlePress = () => {
    lightHaptic();
    onPress();
  };

  const handleLongPress = () => {
    mediumHaptic();

    Alert.alert(
      'Transaction Actions',
      `${category.name} - $${transaction.amount.toFixed(3)}`,
      [
        {
          text: 'View Details',
          onPress: () => {
            lightHaptic();
            onPress();
          },
        },
        {
          text: 'Edit',
          onPress: () => {
            lightHaptic();
            onEdit();
          },
        },
        {
          text: 'Delete',
          onPress: handleDelete,
          style: 'destructive',
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleDelete = () => {
    heavyHaptic();

    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => lightHaptic(),
        },
        {
          text: 'Delete',
          onPress: () => {
            heavyHaptic();
            onDelete();
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleEditPress = () => {
    lightHaptic();
    swipeableRef.current?.close();
    onEdit();
  };

  const handleDeletePress = () => {
    mediumHaptic();
    swipeableRef.current?.close();
    handleDelete();
  };

  const handleSwipeableWillOpen = () => {
    lightHaptic();
  };

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.97,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderLeftActions = () => (
    <TouchableOpacity
      style={styles.deleteAction}
      onPress={handleDeletePress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons
        name="delete"
        size={24}
        color={colors.neutral.white}
      />
      <Text style={styles.actionText}>Delete</Text>
    </TouchableOpacity>
  );

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.editAction}
      onPress={handleEditPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons
        name="pencil"
        size={24}
        color={colors.neutral.white}
      />
      <Text style={styles.actionText}>Edit</Text>
    </TouchableOpacity>
  );

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={handleSwipeableWillOpen}
      friction={2}
      leftThreshold={80}
      rightThreshold={80}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.container}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={animatePress}
          delayLongPress={500}
          activeOpacity={0.95}
        >
          <CategoryIcon icon={category.icon} color={category.color} size="medium" />

          <View style={styles.details}>
            <Text style={styles.categoryName}>{category.name}</Text>
            {transaction.description ? (
              <Text style={styles.description} numberOfLines={1}>
                {transaction.description}
              </Text>
            ) : null}
          </View>

          <View style={styles.rightSection}>
            <Text
              style={[
                styles.amount,
                transaction.type === 'income'
                  ? styles.incomeAmount
                  : styles.expenseAmount,
              ]}
            >
              {formatAmount(transaction.convertedAmount || transaction.amount, accountCurrency, true, transaction.type)}
            </Text>
            {transaction.convertedAmount && transaction.currency !== accountCurrency && (
              <Text style={styles.originalAmount}>
                From {transaction.amount.toFixed(3)} {transaction.currency}
              </Text>
            )}
            <Text style={styles.date}>{formatDate(transaction.date)}</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: themeColors.glass.background,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.glass.borderLight,
  },
  details: {
    flex: 1,
  },
  categoryName: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
    marginBottom: 2,
  },
  description: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  amount: {
    ...typography.body,
    fontWeight: '700',
    marginBottom: 2,
  },
  incomeAmount: {
    color: themeColors.incomeGreen,
  },
  expenseAmount: {
    color: themeColors.expenseRed,
  },
  originalAmount: {
    ...typography.caption,
    color: themeColors.textSecondary,
    fontSize: 10,
    marginTop: 2,
  },
  date: {
    ...typography.caption,
    color: themeColors.textSecondary,
  },
  deleteAction: {
    backgroundColor: themeColors.expenseRed,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  editAction: {
    backgroundColor: themeColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.xs,
  },
  actionText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
