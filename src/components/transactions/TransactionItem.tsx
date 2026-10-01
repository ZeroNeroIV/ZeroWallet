import React, { useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Animated,
} from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CategoryIcon } from './CategoryIcon';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { Transaction, Category } from '../../types/models';
import { lightHaptic, heavyHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';
import { useThemeColors } from '../../hooks/useThemeColors';
import { formatCurrency } from '../../constants/currencies';

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

  const formattedAmount = useMemo(() => {
    const amt = transaction.convertedAmount || transaction.amount;
    const sign = transaction.type === 'income' ? '+' : '-';
    return `${sign}${formatCurrency(amt, accountCurrency)}`;
  }, [transaction, accountCurrency]);

  const formattedDate = useMemo(() => {
    const date = new Date(transaction.date);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }, [transaction.date]);

  const handlePress = () => {
    lightHaptic();
    onPress();
  };

  const handleLongPress = () => {
    mediumHaptic();
    Alert.alert(
      'Transaction Actions',
      `${category.name} • ${formattedAmount}`,
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

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 90,
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
        name="delete-outline"
        size={24}
        color="#FFFFFF"
      />
      <Text style={styles.actionTextWhite}>Delete</Text>
    </TouchableOpacity>
  );

  const renderRightActions = () => (
    <TouchableOpacity
      style={styles.editAction}
      onPress={handleEditPress}
      activeOpacity={0.8}
    >
      <MaterialCommunityIcons
        name="pencil-outline"
        size={24}
        color={themeColors.onPrimary}
      />
      <Text style={[styles.actionText, { color: themeColors.onPrimary }]}>Edit</Text>
    </TouchableOpacity>
  );

  const vaultLabel = useMemo(() => {
    switch (transaction.vaultType) {
      case 'savings':
        return 'Savings';
      case 'held':
        return 'Held';
      case 'card':
        return 'Card';
      case 'physical':
        return 'Cash';
      case 'main':
      default:
        return 'Main';
    }
  }, [transaction.vaultType]);

  return (
    <Swipeable
      ref={swipeableRef}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      overshootLeft={false}
      overshootRight={false}
      onSwipeableWillOpen={() => lightHaptic()}
      friction={2}
      leftThreshold={70}
      rightThreshold={70}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <TouchableOpacity
          style={styles.card}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={animatePress}
          delayLongPress={500}
          activeOpacity={0.92}
        >
          <View style={[styles.iconWrapper, { backgroundColor: `${category.color || themeColors.primary}18` }]}>
            <CategoryIcon icon={category.icon} color={category.color} size="medium" />
          </View>

          <View style={styles.details}>
            <View style={styles.titleRow}>
              <Text style={styles.categoryName} numberOfLines={1}>
                {category.name}
              </Text>
              <View style={styles.vaultBadge}>
                <Text style={styles.vaultBadgeText}>{vaultLabel}</Text>
              </View>
            </View>

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
              {formattedAmount}
            </Text>

            {transaction.convertedAmount && transaction.currency !== accountCurrency ? (
              <Text style={styles.originalAmount}>
                {formatCurrency(transaction.amount, transaction.currency)}
              </Text>
            ) : (
              <Text style={styles.dateText}>{formattedDate}</Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </Swipeable>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeColors.surface,
      borderRadius: 18,
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 5,
      elevation: 2,
    },
    iconWrapper: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    details: {
      flex: 1,
      justifyContent: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 3,
    },
    categoryName: {
      ...typography.body,
      fontWeight: '700',
      color: themeColors.text,
      flexShrink: 1,
    },
    vaultBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: themeColors.surfaceHighlight,
      borderWidth: 1,
      borderColor: themeColors.cardBorder,
    },
    vaultBadgeText: {
      fontSize: 10,
      fontWeight: '700',
      color: themeColors.textSecondary,
      textTransform: 'uppercase',
    },
    description: {
      ...typography.caption,
      color: themeColors.textMuted,
      lineHeight: 16,
    },
    rightSection: {
      alignItems: 'flex-end',
      justifyContent: 'center',
      marginLeft: 8,
    },
    amount: {
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 2,
    },
    incomeAmount: {
      color: themeColors.incomeGreen,
    },
    expenseAmount: {
      color: themeColors.expenseRed,
    },
    originalAmount: {
      fontSize: 11,
      color: themeColors.textMuted,
      fontWeight: '500',
    },
    dateText: {
      fontSize: 11,
      color: themeColors.textMuted,
      fontWeight: '500',
    },
    deleteAction: {
      backgroundColor: '#EF4444',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      borderRadius: 18,
      marginRight: 6,
      gap: 2,
    },
    editAction: {
      backgroundColor: themeColors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      borderRadius: 18,
      marginLeft: 6,
      gap: 2,
    },
    actionText: {
      ...typography.caption,
      fontWeight: '700',
    },
    actionTextWhite: {
      ...typography.caption,
      color: '#FFFFFF',
      fontWeight: '700',
    },
  });
