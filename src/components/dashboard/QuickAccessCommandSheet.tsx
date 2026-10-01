import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { spacing, borderRadius } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { useThemeColors } from '../../hooks/useThemeColors';
import { lightHaptic } from '../../services/haptics/hapticFeedback';
import { MainStackParamList } from '../../types/navigation';

type Nav = StackNavigationProp<MainStackParamList>;

interface QuickAccessCommandSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface CommandItem {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  onPress: (nav: Nav) => void;
}

const COMMAND_ITEMS: CommandItem[] = [
  {
    id: 'wallets',
    title: 'Wallets',
    subtitle: 'Manage & reorder',
    icon: 'wallet-outline',
    color: '#06D6A0',
    onPress: (nav) => nav.navigate('Wallets'),
  },
  {
    id: 'recurring',
    title: 'Recurring',
    subtitle: 'Subscriptions & bills',
    icon: 'refresh-circle',
    color: '#118AB2',
    onPress: (nav) => nav.navigate('Recurring'),
  },
  {
    id: 'transfer',
    title: 'Transfer',
    subtitle: 'Between wallets',
    icon: 'swap-horizontal',
    color: '#FFD166',
    onPress: (nav) => nav.navigate('Transfer'),
  },
  {
    id: 'categories',
    title: 'Categories',
    subtitle: 'Income & expenses',
    icon: 'tag-multiple-outline',
    color: '#EF476F',
    onPress: (nav) => nav.navigate('CategoriesScreen'),
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'Savings targets',
    icon: 'target',
    color: '#4ECDC4',
    onPress: (nav) => nav.navigate('GoalsScreen'),
  },
  {
    id: 'debts',
    title: 'Debts',
    subtitle: 'Lent & borrowed',
    icon: 'hand-coin-outline',
    color: '#FF8B94',
    onPress: (nav) => nav.navigate('DebtsScreen'),
  },
  {
    id: 'chat',
    title: 'AI Assistant',
    subtitle: 'Insights & queries',
    icon: 'robot-outline',
    color: '#B4A7D6',
    onPress: (nav) => nav.navigate('Chat'),
  },
  {
    id: 'settings',
    title: 'Settings',
    subtitle: 'Theme & security',
    icon: 'cog-outline',
    color: '#89CFF0',
    onPress: (nav) => nav.navigate('Settings'),
  },
];

export const QuickAccessCommandSheet: React.FC<QuickAccessCommandSheetProps> = ({
  visible,
  onClose,
}) => {
  const navigation = useNavigation<Nav>();
  const themeColors = useThemeColors();
  const styles = React.useMemo(() => createStyles(themeColors), [themeColors]);

  const handleItemPress = (item: CommandItem) => {
    lightHaptic();
    onClose();
    setTimeout(() => {
      item.onPress(navigation);
    }, 150);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Header */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <MaterialCommunityIcons
                      name="view-grid-outline"
                      size={20}
                      color={themeColors.primary}
                    />
                  </View>
                  <Text style={styles.title}>Quick Access</Text>
                </View>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={8}
                >
                  <MaterialCommunityIcons
                    name="close"
                    size={22}
                    color={themeColors.textSecondary}
                  />
                </TouchableOpacity>
              </View>

              {/* Grid of Command Actions */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.grid}
              >
                {COMMAND_ITEMS.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.card}
                    onPress={() => handleItemPress(item)}
                    activeOpacity={0.7}
                  >
                    <View
                      style={[
                        styles.iconContainer,
                        { backgroundColor: item.color + '20' },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={24}
                        color={item.color}
                      />
                    </View>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const createStyles = (themeColors: ReturnType<typeof useThemeColors>) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: themeColors.surface,
      borderTopLeftRadius: borderRadius.xxl,
      borderTopRightRadius: borderRadius.xxl,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxl,
      maxHeight: '80%',
      borderWidth: 1,
      borderColor: themeColors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.lg,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: 12,
      backgroundColor: themeColors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...typography.h3,
      fontSize: 20,
      fontWeight: '700',
      color: themeColors.text,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: themeColors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
      paddingBottom: spacing.lg,
    },
    card: {
      width: '47.5%',
      backgroundColor: themeColors.background,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: themeColors.border,
      gap: 4,
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    cardTitle: {
      ...typography.body,
      fontWeight: '700',
      fontSize: 15,
      color: themeColors.text,
    },
    cardSubtitle: {
      ...typography.caption,
      fontSize: 12,
      color: themeColors.textSecondary,
    },
  });
