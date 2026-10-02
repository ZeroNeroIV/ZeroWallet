// Simplizum Transaction Details — Architectural Specification View with Dual Currency & Image Viewer
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { format } from 'date-fns';
import type { MainStackParamList } from '../../types/navigation';
import type { Transaction, Category, Wallet } from '../../types/models';
import { useAuthStore } from '../../store/authStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { AccountRepository } from '../../database/repositories/AccountRepository';
import { syncBalancesFromDatabase } from '../../services/walletTransferService';
import { formatCurrency } from '../../utils/currencyFormatter';
import { triggerHaptic } from '../../services/haptics/hapticFeedback';
import { borderRadius } from '../../theme/spacing';
import { ImageViewer } from '../../components/common/ImageViewer';

type NavProp = StackNavigationProp<MainStackParamList, 'TransactionDetails'>;
type RouteProps = RouteProp<MainStackParamList, 'TransactionDetails'>;

export const TransactionDetailsScreen: React.FC = () => {
  const navigation = useNavigation<NavProp>();
  const route = useRoute<RouteProps>();
  const { transactionId } = route.params;
  const { currentAccountId } = useAuthStore();
  const themeColors = useThemeColors();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [destinationWallet, setDestinationWallet] = useState<Wallet | null>(null);
  const [accountCurrency, setAccountCurrency] = useState('USD');
  const [loading, setLoading] = useState(true);

  // Image viewer state
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const loadData = useCallback(async () => {
    if (!transactionId || !currentAccountId) return;
    try {
      setLoading(true);
      const txRepo = new TransactionRepository();
      const catRepo = new CategoryRepository();
      const walletRepo = new WalletRepository();
      const accRepo = new AccountRepository();

      const [txn, acc] = await Promise.all([
        txRepo.findById(transactionId),
        accRepo.findById(currentAccountId),
      ]);

      if (!txn) {
        Alert.alert('Not Found', 'Transaction could not be found.');
        navigation.goBack();
        return;
      }

      setTransaction(txn);
      if (acc?.currency) setAccountCurrency(acc.currency);

      const [cat, w, destW] = await Promise.all([
        txn.categoryId ? catRepo.findById(txn.categoryId) : Promise.resolve(null),
        walletRepo.findByAccountAndId(currentAccountId, txn.walletId || txn.vaultType),
        txn.destinationWalletId
          ? walletRepo.findByAccountAndId(currentAccountId, txn.destinationWalletId)
          : Promise.resolve(null),
      ]);

      setCategory(cat);
      setWallet(w);
      setDestinationWallet(destW);
    } catch (err) {
      console.warn('[TransactionDetailsScreen] loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [transactionId, currentAccountId, navigation]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleDelete = () => {
    Alert.alert(
      'Delete Entry',
      'Are you sure you want to delete this transaction? This action will reverse its effect on your wallet balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!currentAccountId || !transaction) return;
              const txRepo = new TransactionRepository();
              await txRepo.delete(transaction.id);
              await syncBalancesFromDatabase(currentAccountId);
              triggerHaptic('notificationSuccess');
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err?.message || 'Failed to delete transaction.');
            }
          },
        },
      ]
    );
  };

  const images = useMemo(() => {
    if (transaction?.images && transaction.images.length > 0) {
      return transaction.images;
    }
    if (transaction?.imagePath) {
      return [transaction.imagePath];
    }
    return [];
  }, [transaction]);

  if (loading && !transaction) {
    return (
      <View style={[styles.root, styles.center, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator color={themeColors.text} size="small" />
      </View>
    );
  }

  if (!transaction) return null;

  const isTransfer = transaction.type === 'transfer' || !!transaction.destinationWalletId;
  const isIncome = transaction.type === 'income';
  const baseAmount = transaction.convertedAmount ?? transaction.amount;
  const hasForeignCurrency =
    transaction.currency && transaction.currency !== accountCurrency && transaction.originalAmount;

  return (
    <View style={[styles.root, { backgroundColor: themeColors.background }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Hero Amount Card */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          <View style={styles.heroTopRow}>
            <View
              style={[
                styles.typeBadge,
                {
                  borderColor: themeColors.hairline,
                  backgroundColor: themeColors.background,
                },
              ]}
            >
              <Text style={[styles.typeBadgeText, { color: themeColors.textMuted }]}>
                {transaction.type.toUpperCase()}
              </Text>
            </View>

            <Text style={[styles.dateText, { color: themeColors.textMuted }]}>
              {format(new Date(transaction.date), 'dd MMM yyyy, h:mm a').toUpperCase()}
            </Text>
          </View>

          {/* Big Amount */}
          <Text
            style={[
              styles.amountText,
              {
                color: isTransfer
                  ? themeColors.text
                  : isIncome
                  ? themeColors.success
                  : themeColors.text,
              },
            ]}
          >
            {isTransfer ? '⇄ ' : isIncome ? '+' : '-'}
            {formatCurrency(baseAmount, accountCurrency)}
          </Text>

          {/* Dual Currency Subtext */}
          {hasForeignCurrency && (
            <View style={styles.dualCurrencyRow}>
              <Text style={[styles.foreignAmountText, { color: themeColors.textMuted }]}>
                Original: {formatCurrency(transaction.originalAmount!, transaction.currency)}
              </Text>
              {transaction.exchangeRate && (
                <Text style={[styles.exchangeRateText, { color: themeColors.textMuted }]}>
                  (Rate: 1 {transaction.currency} = {transaction.exchangeRate.toFixed(4)} {accountCurrency})
                </Text>
              )}
            </View>
          )}
        </View>

        {/* 2. Architectural Specification Table */}
        <View
          style={[
            styles.specsCard,
            {
              backgroundColor: themeColors.surface,
              borderColor: themeColors.cardBorder,
            },
          ]}
        >
          {/* Row: Description / Memo */}
          <View style={[styles.specRow, { borderBottomColor: themeColors.hairline }]}>
            <Text style={[styles.specLabel, { color: themeColors.textMuted }]}>
              MEMO / TITLE
            </Text>
            <Text style={[styles.specValue, { color: themeColors.text }]}>
              {transaction.description || 'No description provided'}
            </Text>
          </View>

          {/* Row: Category */}
          <View style={[styles.specRow, { borderBottomColor: themeColors.hairline }]}>
            <Text style={[styles.specLabel, { color: themeColors.textMuted }]}>
              CATEGORY
            </Text>
            <View style={styles.categoryValueRow}>
              {category?.icon && (
                <MaterialCommunityIcons
                  name={category.icon}
                  size={16}
                  color={themeColors.text}
                  style={{ marginRight: 6 }}
                />
              )}
              <Text style={[styles.specValue, { color: themeColors.text }]}>
                {category?.name || 'Uncategorized'}
              </Text>
            </View>
          </View>

          {/* Row: Source Wallet */}
          <View style={[styles.specRow, { borderBottomColor: themeColors.hairline }]}>
            <Text style={[styles.specLabel, { color: themeColors.textMuted }]}>
              {isTransfer ? 'SOURCE WALLET' : 'WALLET'}
            </Text>
            <View style={styles.categoryValueRow}>
              <MaterialCommunityIcons
                name={wallet?.icon || 'wallet-outline'}
                size={16}
                color={themeColors.text}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.specValue, { color: themeColors.text }]}>
                {wallet?.name || transaction.walletId || transaction.vaultType}
              </Text>
            </View>
          </View>

          {/* Row: Destination Wallet (If transfer) */}
          {isTransfer && destinationWallet && (
            <View style={[styles.specRow, { borderBottomColor: themeColors.hairline }]}>
              <Text style={[styles.specLabel, { color: themeColors.textMuted }]}>
                DESTINATION WALLET
              </Text>
              <View style={styles.categoryValueRow}>
                <MaterialCommunityIcons
                  name={destinationWallet.icon || 'wallet-outline'}
                  size={16}
                  color={themeColors.text}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.specValue, { color: themeColors.text }]}>
                  {destinationWallet.name}
                </Text>
              </View>
            </View>
          )}

          {/* Row: Recurring Flag */}
          <View style={styles.specRow}>
            <Text style={[styles.specLabel, { color: themeColors.textMuted }]}>
              COMMITMENT TYPE
            </Text>
            <Text style={[styles.specValue, { color: themeColors.text }]}>
              {transaction.isRecurring ? 'RECURRING AUTOMATION' : 'ONE-TIME MANUAL'}
            </Text>
          </View>
        </View>

        {/* 3. Attached Receipts & Proof */}
        {images.length > 0 && (
          <View
            style={[
              styles.receiptsCard,
              {
                backgroundColor: themeColors.surface,
                borderColor: themeColors.cardBorder,
              },
            ]}
          >
            <Text style={[styles.receiptsTitle, { color: themeColors.textMuted }]}>
              ATTACHED RECEIPT ({images.length})
            </Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.receiptsRow}>
              {images.map((uri, idx) => (
                <TouchableOpacity
                  key={uri + idx}
                  activeOpacity={0.8}
                  onPress={() => {
                    triggerHaptic('selection');
                    setActiveImageIndex(idx);
                    setViewerVisible(true);
                  }}
                  style={[
                    styles.thumbnailWrapper,
                    {
                      borderColor: themeColors.hairline,
                      backgroundColor: themeColors.background,
                    },
                  ]}
                >
                  <Image source={{ uri }} style={styles.thumbnail} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 4. Action Duo: Edit & Delete */}
        <View style={styles.actionDuoRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('selection');
              navigation.navigate('AddTransaction', { transactionId: transaction.id });
            }}
            style={[
              styles.actionBtn,
              {
                borderColor: themeColors.cardBorder,
                backgroundColor: themeColors.surface,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="pencil-outline"
              size={16}
              color={themeColors.text}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.actionBtnText, { color: themeColors.text }]}>
              EDIT ENTRY
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              triggerHaptic('impactMedium');
              handleDelete();
            }}
            style={[
              styles.actionBtn,
              {
                borderColor: themeColors.error,
                backgroundColor: themeColors.surface,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={16}
              color={themeColors.error}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.actionBtnText, { color: themeColors.error }]}>
              DELETE ENTRY
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Full-Screen Image Viewer */}
      {images.length > 0 && (
        <ImageViewer
          visible={viewerVisible}
          images={images}
          initialIndex={activeImageIndex}
          onClose={() => setViewerVisible(false)}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 18,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 2,
  },
  typeBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  amountText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginBottom: 4,
  },
  dualCurrencyRow: {
    marginTop: 4,
  },
  foreignAmountText: {
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  exchangeRateText: {
    fontSize: 11,
    marginTop: 2,
  },
  specsCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  specRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  specLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  specValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  categoryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  receiptsCard: {
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    padding: 16,
    marginBottom: 16,
  },
  receiptsTitle: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  receiptsRow: {
    flexDirection: 'row',
  },
  thumbnailWrapper: {
    width: 72,
    height: 72,
    borderRadius: 2,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: 10,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  actionDuoRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderRadius: borderRadius.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
});
