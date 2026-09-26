import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CategoryIcon } from '../../components/transactions/CategoryIcon';
import { Button } from '../../components/forms/Button';
import { ImageViewer } from '../../components/common/ImageViewer';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { MainStackParamList } from '../../types/navigation';
import { Transaction, Category, VaultType } from '../../types/models';
import { walletShortName } from '../../utils/wallets';
import { useVaultStore } from '../../store/vaultStore';
import { useThemeColors } from '../../hooks/useThemeColors';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { deleteTransactionImage } from '../../utils/imageStorage';

type TransactionDetailsScreenNavigationProp = StackNavigationProp<
  MainStackParamList,
  'TransactionDetails'
>;

type TransactionDetailsScreenRouteProp = RouteProp<
  MainStackParamList,
  'TransactionDetails'
>;

export const TransactionDetailsScreen: React.FC = () => {
  const navigation = useNavigation<TransactionDetailsScreenNavigationProp>();
  const route = useRoute<TransactionDetailsScreenRouteProp>();
  const { transactionId } = route.params;

  const { addToVault, subtractFromVault } = useVaultStore();
  const themeColors = useThemeColors();

  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [imageLoadError, setImageLoadError] = useState(false);

  const transactionRepo = new TransactionRepository();
  const categoryRepo = new CategoryRepository();

  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  useEffect(() => {
    loadTransaction();
  }, [transactionId]);

  // Reload when returning from the edit screen
  useFocusEffect(
    useCallback(() => {
      loadTransaction();
    }, [transactionId])
  );

  const loadTransaction = async () => {
    try {
      setLoading(true);

      const txn = await transactionRepo.findById(transactionId);
      if (!txn) {
        Alert.alert('Error', 'Transaction not found');
        navigation.goBack();
        return;
      }

      const cat = txn.categoryId ? await categoryRepo.findById(txn.categoryId) : null;
      const { WalletRepository } = await import('../../database/repositories/WalletRepository');
      const walletRow = await new WalletRepository().findById(txn.vaultType).catch(() => null);
      setWalletName(walletRow?.name ?? null);

      console.log('[TransactionDetails] Transaction loaded:', {
        id: txn.id,
        hasImage: !!txn.imagePath,
        imagePath: txn.imagePath,
      });

      setTransaction(txn);
      setCategory(cat || null);
    } catch (error) {
      console.error('[TransactionDetails] Error loading transaction:', error);
      Alert.alert('Error', 'Failed to load transaction details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!transaction) return;

              // Delete associated image files if they exist
              if (transaction.imagePath) {
                await deleteTransactionImage(transaction.id);
              }

              // Delete transaction from SQLite
              await transactionRepo.delete(transaction.id);

              // Reverse the balance change in MMKV
              // Use converted amount if it exists, otherwise use regular amount
              const balanceAmount = transaction.convertedAmount || transaction.amount;
              if (transaction.type === 'income') {
                subtractFromVault(transaction.vaultType, balanceAmount);
              } else {
                addToVault(transaction.vaultType, balanceAmount);
              }

              Alert.alert('Success', 'Transaction deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => navigation.goBack(),
                },
              ]);
            } catch (error) {
              console.error('[TransactionDetails] Error deleting transaction:', error);
              Alert.alert('Error', 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  const formatAmount = (amount: number) => {
    return `$${amount.toFixed(3)}`;
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    };
    return date.toLocaleDateString('en-US', options);
  };

  const getVaultLabel = (vault: string) => {
    if (walletName) return walletName;
    if (vault === 'main' || vault === 'savings' || vault === 'held') {
      return walletShortName(vault as VaultType);
    }
    return vault.charAt(0).toUpperCase() + vault.slice(1);
  };

  const handleEdit = () => {
    navigation.navigate('AddTransaction', { transactionId });
  };

  if (loading || !transaction) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* Header Section */}
        <View style={styles.header}>
          <CategoryIcon
            icon={category?.icon ?? 'help-circle'}
            color={category?.color ?? '#999'}
            size="large"
          />
          <Text style={styles.categoryName}>{category?.name ?? 'Unknown'}</Text>
          <Text
            style={[
              styles.amount,
              transaction.type === 'income' ? styles.incomeAmount : styles.expenseAmount,
            ]}
          >
            {transaction.type === 'income' ? '+' : '-'}
            {formatAmount(transaction.convertedAmount || transaction.amount)}
            {transaction.currency !== 'USD' && transaction.convertedAmount && (
              <Text style={styles.originalAmount}>
                {' '}({formatAmount(transaction.amount)} {transaction.currency})
              </Text>
            )}
          </Text>
        </View>

        {/* Receipt Images */}
        {((transaction.images && transaction.images.length > 0) || transaction.imagePath) && (() => {
          const allImages: string[] = transaction.images && transaction.images.length > 0
            ? transaction.images
            : transaction.imagePath
              ? [transaction.imagePath]
              : [];
          return (
            <View style={styles.imageSection}>
              <View style={styles.imageHeader}>
                <MaterialCommunityIcons name="receipt" size={20} color={themeColors.primary} />
                <Text style={styles.imageSectionTitle}>
                  Receipt / Proof ({allImages.length})
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {allImages.map((img, idx) => {
                  const uri = img.startsWith('file://') ? img : `file://${img}`;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => { setViewerIndex(idx); setShowImageViewer(true); }}
                      activeOpacity={0.8}
                      style={styles.thumbWrap}
                    >
                      <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                      <View style={styles.imageOverlay}>
                        <MaterialCommunityIcons name="magnify-plus" size={24} color="#FFF" />
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          );
        })()}

        {/* Details Section */}
        <View style={styles.detailsSection}>
          <DetailRow
            icon="calendar"
            label="Date"
            value={formatDate(transaction.date)}
          />
          <DetailRow
            icon="wallet"
            label="Wallet"
            value={getVaultLabel(transaction.vaultType)}
          />
          <DetailRow
            icon="swap-horizontal"
            label="Type"
            value={transaction.type === 'income' ? 'Income' : 'Expense'}
          />
          {transaction.description ? (
            <DetailRow
              icon="note-text"
              label="Description"
              value={transaction.description}
            />
          ) : null}
          {transaction.isRecurring && (
            <DetailRow
              icon="repeat"
              label="Recurring"
              value="Yes"
            />
          )}
        </View>

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <Button
            title="Edit Transaction"
            onPress={handleEdit}
            leftIcon={<MaterialCommunityIcons name="pencil" size={20} color="#FFF" />}
          />
          <Button
            title="Delete Transaction"
            onPress={handleDelete}
            variant="outline"
            style={styles.deleteButton}
          />
        </View>
      </View>

      {/* Image Viewer Modal */}
      {showImageViewer && (() => {
        const allImages = transaction.images && transaction.images.length > 0
          ? transaction.images
          : transaction.imagePath ? [transaction.imagePath] : [];
        const uris = allImages.map(img => img.startsWith('file://') ? img : `file://${img}`);
        return (
          <ImageViewer
            visible={showImageViewer}
            images={uris}
            initialIndex={viewerIndex}
            onClose={() => setShowImageViewer(false)}
          />
        );
      })()}
    </ScrollView>
  );
};

interface DetailRowProps {
  icon: string;
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ icon, label, value }) => {
  const themeColors = useThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

  return (
    <View style={styles.detailRow}>
      <View style={styles.detailLabel}>
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={themeColors.textSecondary}
        />
        <Text style={styles.detailLabelText}>{label}</Text>
      </View>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themeColors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: themeColors.background,
  },
  loadingText: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
  content: {
    padding: spacing.lg,
  },
  header: {
    alignItems: 'center',
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    marginBottom: spacing.lg,
  },
  categoryName: {
    ...typography.h2,
    color: themeColors.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  amount: {
    ...typography.h1,
    fontWeight: '700',
  },
  incomeAmount: {
    color: themeColors.success,
  },
  expenseAmount: {
    color: themeColors.error,
  },
  originalAmount: {
    ...typography.bodySmall,
    color: themeColors.textSecondary,
    fontWeight: '400',
  },
  detailsSection: {
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: themeColors.border,
  },
  detailLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailLabelText: {
    ...typography.body,
    color: themeColors.textSecondary,
  },
  detailValue: {
    ...typography.body,
    fontWeight: '600',
    color: themeColors.text,
  },
  actionsSection: {
    gap: spacing.md,
  },
  deleteButton: {
    borderColor: themeColors.error,
  },
  imageSection: {
    backgroundColor: themeColors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  imageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  imageSectionTitle: {
    ...typography.bodyLarge,
    fontWeight: '600',
    color: themeColors.text,
  },
  imageContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    aspectRatio: 1,
    backgroundColor: themeColors.background,
  },
  thumbWrap: {
    width: 110,
    height: 110,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: spacing.sm,
    position: 'relative',
  },
  thumbnailImage: {
    width: 110,
    height: 110,
  },
  imageOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageOverlayText: {
    ...typography.caption,
    color: '#FFFFFF',
    marginTop: spacing.xs,
  },
  imageErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  imageErrorText: {
    ...typography.body,
    color: themeColors.textSecondary,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  imageErrorPath: {
    ...typography.caption,
    color: themeColors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
