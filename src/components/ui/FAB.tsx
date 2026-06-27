import React, { useState } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  Pressable,
} from 'react-native';
import { MotiView } from 'moti';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { colors } from '../../theme/colors';
import { spacing } from '../../theme/spacing';
import { typography } from '../../theme/typography';
import { lightHaptic, mediumHaptic } from '../../services/haptics/hapticFeedback';

interface FABAction {
  icon: string;
  label: string;
  onPress: () => void;
  color?: string;
}

interface FABProps {
  actions: FABAction[];
  mainIcon?: string;
}

export const FAB: React.FC<FABProps> = ({
  actions,
  mainIcon = 'plus',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    mediumHaptic();
    setIsOpen(!isOpen);
  };

  return (
    <View style={styles.container}>
      {/* Backdrop */}
      {isOpen && (
        <Pressable style={styles.backdrop} onPress={toggleMenu}>
          <MotiView
            from={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'timing', duration: 200 }}
            style={StyleSheet.absoluteFillObject}
          />
        </Pressable>
      )}

      {/* Action buttons */}
      {isOpen && (
        <View style={styles.actionsContainer}>
          {actions.map((action, index) => (
            <MotiView
              key={action.label}
              from={{
                opacity: 0,
                translateY: 20,
              }}
              animate={{
                opacity: 1,
                translateY: 0,
              }}
              exit={{
                opacity: 0,
                translateY: 20,
              }}
              transition={{
                type: 'spring',
                delay: index * 50,
                damping: 15,
              }}
              style={styles.actionItemContainer}
            >
              <View style={styles.actionItem}>
                <View style={styles.labelContainer}>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    { backgroundColor: action.color || colors.primary.main },
                  ]}
                  onPress={() => {
                    lightHaptic();
                    action.onPress();
                    setIsOpen(false);
                  }}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name={action.icon as any}
                    size={24}
                    color={colors.neutral.white}
                  />
                </TouchableOpacity>
              </View>
            </MotiView>
          ))}
        </View>
      )}

      {/* Main FAB button */}
      <MotiView
        animate={{
          rotate: isOpen ? '45deg' : '0deg',
          scale: isOpen ? 1.1 : 1,
        }}
        transition={{
          type: 'spring',
          damping: 15,
        }}
      >
        <TouchableOpacity
          style={styles.fab}
          onPress={toggleMenu}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons
            name={mainIcon as any}
            size={28}
            color={colors.neutral.white}
          />
        </TouchableOpacity>
      </MotiView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    alignItems: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  actionsContainer: {
    position: 'absolute',
    bottom: 80,
    right: 0,
    gap: spacing.md,
  },
  actionItemContainer: {
    alignItems: 'flex-end',
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  labelContainer: {
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: spacing.sm,
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  actionLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.neutral.gray900,
  },
  actionButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 5,
  },
});
