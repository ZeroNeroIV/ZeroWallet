<div align="center">

# ZeroWallet

**A private, offline-first personal finance app with a three-vault system and an on-device AI assistant (Laya).**

![React Native](https://img.shields.io/badge/React%20Native-0.80-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Platforms](https://img.shields.io/badge/platforms-iOS%20%7C%20Android-lightgrey)

</div>

---

## Overview

ZeroWallet tracks spending, savings, debts, goals and recurring commitments. All data lives on the device (SQLite + MMKV). An optional AI assistant, **Laya**, can answer questions, log transactions and categorize them automatically.

The UI follows the **Simplizum** design language: 1px hairline borders, 2px corner radius, sharp uppercase typography, monospace tags and sparse layouts.

## Features

- **Wallets & three-vault system** — each account has `main` (spending), `savings` and `held` (third-party) vaults; transactions are tagged by vault.
- **Horizontal tab paging** — Dashboard, Wallets, Recurring and Settings live in one swipeable pager with a persistent floating bottom navigation bar (no push/pop between hubs).
- **Dashboard** — net worth, wallet strip, next-due ticker, 30-day cash-flow trend and recent movements. The eye icon hides **every** number on the screen.
- **Transactions** — expense / income / transfer, multi-currency with automatic conversion, receipt images.
- **Laya auto-categorization** — after you stop typing a description (600 ms debounce), Laya picks the closest category. If confidence is below 55% it selects **Other** and suggests a new *general* category you can add with one tap.
- **Recurring & subscriptions** — unified hub with auto-deduct and notifications.
- **Goals, debts and category budgets.**
- **AI settings** — Gemini, Groq or any OpenAI-compatible endpoint (Ollama, LM Studio, OpenAI). The model list is loaded live from the provider's API; you choose which model to use.
- **Currencies** — always displayed as 3-letter ISO codes (e.g. `USD 12.500`).
- **Editing screens** — Save / Update buttons float at the bottom, aligned with the nav bar, and content is padded so the last fields are never covered.
- **Security** — biometric + PIN with auto-lock.
- **Data transfer** — export / import backups.

## Tech stack

| Area | Choice |
| --- | --- |
| Framework | React Native 0.80 (bare, no Expo) |
| Language | TypeScript |
| State | Zustand 5 + MMKV persistence |
| Storage | MMKV (key-value) + SQLite (`react-native-sqlite-storage`) |
| Navigation | React Navigation v7 (stack) |
| AI | Google Gemini, Groq, OpenAI-compatible endpoints |
| Charts | `react-native-gifted-charts`, `react-native-svg` |
| Animation | Reanimated 4, Moti |
| Lists | FlashList |
| Notifications | Notifee + Firebase Cloud Messaging |

## Project structure

```
src/
├── screens/      # accounts, auth, categories, chat, dashboard, debts, goals,
│                 # main (tab pager), recurring, security, settings, subscriptions,
│                 # transactions, vault, wallets
├── components/   # bento, chat, common, dashboard, debts, forms, goals,
│                 # navigation, settings, transactions, ui, vault
├── database/     # schema, repositories, migrations
├── services/     # ai (Laya / Gemini), backgroundTasks, biometric,
│                 # dataTransfer, notifications, currencyService
├── store/        # Zustand stores (auth, account, vault, settings, ui, aiChat, navigationTab)
├── hooks/        # useAutoCategorize, useWallets, useThemeColors, ...
├── constants/    # currencies, aiProviders
└── theme/        # colors, spacing, typography, animations
```

## Getting started

### Prerequisites

- Node.js 18+ and Yarn
- JDK 17 and Android Studio (Android)
- Xcode and CocoaPods (iOS, macOS only)
- Follow the [React Native environment setup](https://reactnative.dev/docs/set-up-your-development-environment)

### Install

```sh
yarn install
yarn pod          # iOS only
```

### Run

```sh
yarn start        # Metro on port 8082
yarn android
yarn ios
```

### Build (Android)

```sh
yarn apk          # release APK
yarn aab          # release AAB
```

### Other scripts

```sh
yarn lint
yarn test
yarn generate:icons
```

## AI configuration

Open **Settings → AI & Laya** and:

1. Pick a provider (Gemini, Groq, or Custom / Local).
2. Enter your API key (or base URL for a local endpoint).
3. Choose a model from the list loaded from the provider.
4. Save.

API keys are entered by the user at runtime and stored on-device; nothing is hardcoded in the repo.

## Conventions

- Functional components with hooks; no class components.
- `StyleSheet` for styles; `FlashList` for lists.
- Single quotes, trailing commas.
- See [`AGENTS.md`](AGENTS.md) for the full contributor / AI-agent guidelines.

## Changelog

Notable recent changes:

- Horizontal tab paging with a persistent bottom navigation bar.
- `+` button in the Wallets header (replaces the large "New Wallet" button).
- Live model loading in AI settings.
- 3-letter ISO currency display everywhere.
- Floating Save / Update buttons on editing screens.
- Eye icon hides all dashboard numbers.
- Laya auto-categorization with debounce and one-tap general-category suggestion.

> This README is updated with every change to the app.
