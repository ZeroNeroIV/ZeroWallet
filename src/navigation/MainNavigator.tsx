// Main Stack Navigator - All authenticated screens
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { MainStackParamList } from '../types/navigation';
import AccountsListScreen from '../screens/accounts/AccountsListScreen';
import CreateAccountScreen from '../screens/accounts/CreateAccountScreen';
import AccountSettingsScreen from '../screens/accounts/AccountSettingsScreen';
import { AddTransactionScreen } from '../screens/transactions/AddTransactionScreen';
import { TransactionHistoryScreen } from '../screens/transactions/TransactionHistoryScreen';
import { TransactionDetailsScreen } from '../screens/transactions/TransactionDetailsScreen';
import { VaultManagementScreen } from '../screens/vault/VaultManagementScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import CategoriesScreen from '../screens/categories/CategoriesScreen';
import CreateCategoryScreen from '../screens/categories/CreateCategoryScreen';
import SubscriptionsScreen from '../screens/subscriptions/SubscriptionsScreen';
import AddSubscriptionScreen from '../screens/subscriptions/AddSubscriptionScreen';
import RecurringExpensesScreen from '../screens/recurring/RecurringExpensesScreen';
import AddRecurringExpenseScreen from '../screens/recurring/AddRecurringExpenseScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import SalarySettingsScreen from '../screens/settings/SalarySettingsScreen';
import SecuritySettingsScreen from '../screens/security/SecuritySettingsScreen';
import GoalsScreen from '../screens/goals/GoalsScreen';
import CreateGoalScreen from '../screens/goals/CreateGoalScreen';
import DebtsScreen from '../screens/debts/DebtsScreen';
import AddDebtScreen from '../screens/debts/AddDebtScreen';
import DebtDetailsScreen from '../screens/debts/DebtDetailsScreen';
import AISettingsScreen from '../screens/settings/AISettingsScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import AllSectionsScreen from '../screens/sections/AllSectionsScreen';
import BudgetScreen from '../screens/budget/BudgetScreen';
import { useThemeColors } from '../hooks/useThemeColors';
import { TouchableOpacity, Alert } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAIChatStore } from '../store/aiChatStore';

const Stack = createStackNavigator<MainStackParamList>();

export function MainNavigator() {
  const themeColors = useThemeColors();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: themeColors.primary,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AccountsList"
        component={AccountsListScreen}
        options={{ title: 'My Accounts' }}
      />
      <Stack.Screen
        name="CreateAccount"
        component={CreateAccountScreen}
        options={{ title: 'Create Account' }}
      />
      <Stack.Screen
        name="AccountSettings"
        component={AccountSettingsScreen}
        options={{ title: 'Account Settings' }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen
        name="AddTransaction"
        component={AddTransactionScreen}
        options={{
          title: 'Add Transaction',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="TransactionHistory"
        component={TransactionHistoryScreen}
        options={{ title: 'Transaction History' }}
      />
      <Stack.Screen
        name="TransactionDetails"
        component={TransactionDetailsScreen}
        options={{ title: 'Transaction Details' }}
      />
      <Stack.Screen
        name="VaultManagement"
        component={VaultManagementScreen}
        options={{ title: 'Vault Management' }}
      />
      <Stack.Screen
        name="CategoriesScreen"
        component={CategoriesScreen}
        options={{ title: 'Categories' }}
      />
      <Stack.Screen
        name="CreateCategory"
        component={CreateCategoryScreen}
        options={({ route }) => ({
          title:
            'mode' in route.params && route.params.mode === 'edit'
              ? 'Edit Category'
              : 'Create Category',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="SubscriptionsScreen"
        component={SubscriptionsScreen}
        options={{ title: 'Subscriptions' }}
      />
      <Stack.Screen
        name="AddSubscription"
        component={AddSubscriptionScreen}
        options={({ route }) => ({
          title:
            route.params?.mode === 'edit'
              ? 'Edit Subscription'
              : 'Add Subscription',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="RecurringExpenses"
        component={RecurringExpensesScreen}
        options={{ title: 'Recurring Expenses' }}
      />
      <Stack.Screen
        name="AddRecurring"
        component={AddRecurringExpenseScreen}
        options={({ route }) => ({
          title:
            route.params?.mode === 'edit'
              ? 'Edit Recurring Expense'
              : 'Add Recurring Expense',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="SalarySettings"
        component={SalarySettingsScreen}
        options={{ title: 'Salary Settings' }}
      />
      <Stack.Screen
        name="SecuritySettings"
        component={SecuritySettingsScreen}
        options={{ title: 'Security Settings' }}
      />
      <Stack.Screen
        name="GoalsScreen"
        component={GoalsScreen}
        options={{ title: 'Goals' }}
      />
      <Stack.Screen
        name="CreateGoal"
        component={CreateGoalScreen}
        options={{ title: 'Create Goal', presentation: 'modal' }}
      />
      <Stack.Screen
        name="EditGoal"
        component={CreateGoalScreen}
        options={{ title: 'Edit Goal', presentation: 'modal' }}
      />
      <Stack.Screen
        name="GoalDetails"
        component={GoalsScreen}
        options={{ title: 'Goal Details' }}
      />
      <Stack.Screen
        name="DebtsScreen"
        component={DebtsScreen}
        options={{ title: 'Debts' }}
      />
      <Stack.Screen
        name="AddDebt"
        component={AddDebtScreen}
        options={({ route }) => ({
          title: route.params?.type === 'borrowed' ? 'I Borrowed Money' : 'I Lent Money',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="EditDebt"
        component={AddDebtScreen}
        options={{ title: 'Edit Debt', presentation: 'modal' }}
      />
      <Stack.Screen
        name="DebtDetails"
        component={DebtDetailsScreen}
        options={{ title: 'Debt Details' }}
      />
      <Stack.Screen
        name="AISettings"
        component={AISettingsScreen}
        options={{ title: 'AI Settings' }}
      />
      <Stack.Screen
        name="ChatScreen"
        component={ChatScreen}
        options={({ navigation }) => ({
          title: 'AI Assistant',
          headerRight: () => (
            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Clear Conversation',
                  'Are you sure you want to clear all messages? This cannot be undone.',
                  [
                    {
                      text: 'Cancel',
                      style: 'cancel',
                    },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: () => {
                        const { clearMessages } = useAIChatStore.getState();
                        clearMessages();
                      },
                    },
                  ]
                );
              }}
              style={{ marginRight: 16 }}
            >
              <MaterialCommunityIcons
                name="delete-outline"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="AllSectionsScreen"
        component={AllSectionsScreen}
        options={{ title: 'All Sections' }}
      />
      <Stack.Screen
        name="BudgetScreen"
        component={BudgetScreen}
        options={{ title: 'Budget' }}
      />
    </Stack.Navigator>
  );
}
