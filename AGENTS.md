# ZeroWallet — AI Agent Guidelines

## Project Overview
- **Framework:** React Native 0.80.0 (bare, no Expo)
- **Language:** TypeScript throughout
- **State Management:** Zustand 5 with MMKV persistence
- **Storage:** MMKV (fast KV) + SQLite (relational data via react-native-sqlite-storage)
- **Navigation:** React Navigation v7 (stack navigator)
- **AI:** Google Gemini (1.5 Flash / 2.5 Flash / 1.5 Pro) with function calling
- **Charts:** Victory Native + react-native-gifted-charts
- **Animations:** react-native-reanimated 4, Moti, Skia
- **Notifications:** Notifee + Firebase Cloud Messaging
- **Security:** Biometric + PIN with auto-lock

## Architecture
- **src/screens/** — 16 screen directories (accounts, auth, categories, chat, dashboard, debts, goals, recurring, security, settings, subscriptions, transactions, vault, etc.)
- **src/components/** — bento, chat, common, dashboard, debts, forms, goals, navigation, settings, transactions, ui, vault
- **src/database/** — schema (v5, 9 tables), repositories (8), migrations
- **src/services/** — ai/ (Gemini service with function calling), backgroundTasks, biometric, dataTransfer, notifications, currencyService
- **src/store/** — 7 Zustand stores (auth, account, vault, settings, ui, aiChat)
- **src/theme/** — colors, spacing, typography, animations

## Code Conventions
- Functional components with hooks, no class components
- PascalCase for components, camelCase for functions/variables, UPPER_SNAKE_CASE for constants
- Single quotes, trailing commas, no unnecessary comments
- Direct imports, avoid barrel exports
- Use FlashList (not FlatList) for lists
- React.memo + useCallback + useMemo for perf
- StyleSheet for styles, no inline styles

## Three-Vault System
Each account has: main (spending), savings, held (third-party). Transactions tagged by vault type.

## Key Rules
- Never hardcode sensitive values (API keys, etc.)
- Test on both iOS and Android
- Keep changes minimal, follow existing patterns
- Use TypeScript for all new files
