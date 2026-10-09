# ZeroWallet — Release Notes & Changelog

Welcome to the comprehensive release documentation for **ZeroWallet**, an offline-first personal financial operating system built on mathematical ledger certainty, local-first SQLite relational persistence, and privacy-preserving architectural principles.

---

## [1.0.35] — 2026-10-09

### Highlights
- **Zero-Latency Touch & Interaction Engine**: Eradicated touch delay across all interactive components, buttons, navigation tabs, and sheets.
- **Horizontal Gesture Isolation**: Paging gestures no longer conflict with nested horizontal scrolling (wallets strip, filter chips, cash flow scrubbers).
- **Navigation & Screen Transition Snappiness**: Native hardware-accelerated screen caching via `react-native-screens` and calibrated iOS horizontal interpolators.
- **Layout Precision & Overflow Eradication**: Fixed subpixel calendar grid line wrapping, floating bottom navigation overlaps, and header text collisions.
- **In-App Release Notes**: Built-in modal viewer directly accessible within the app under Settings.

### 🚀 New Features
- **In-App Release Notes & Changelog**:
  - Accessible directly in **Settings → System Build Info** via the `VIEW RELEASE NOTES & CHANGELOG` button.
  - Interactive page-sheet modal detailing full version changelogs with categorized feature, bug fix, and optimization tags.
- **Hardware-Accelerated Native Screen Caching**:
  - Activated `enableScreens(true)` via `react-native-screens` at application bootstrap (`index.js`).
  - Screen transitions now run directly in native Android Fragments and iOS UIViewController stacks rather than un-optimized JS view hierarchies.

### 🐛 Bug Fixes
- **Touch Responsiveness Delay**:
  - Root Cause: React Native's nested `ScrollView`s default `delaysContentTouches={true}` (150ms delay per nesting layer), resulting in a 300ms perceived delay before buttons responded to touches. Additionally, `TouchableOpacity` without `delayPressIn={0}` held back visual feedback.
  - Fix: Configured `delaysContentTouches={false}` on all outer and inner `ScrollView` instances across `MainTabScreen`, `DashboardScreen`, `CalendarScreen`, `SettingsScreen`, `RecurringHubScreen`, `TransactionHistoryScreen`, and `GoogleDriveBackupScreen`.
  - Added `delayPressIn={0}` and generous `hitSlop` to `Button`, `BottomNavigation`, `QuickAddSheet`, and all interactive cards.
- **Horizontal Scroll Gesture Hijacking**:
  - Root Cause: An outer horizontal paging `ScrollView` on `MainTabScreen` intercepted horizontal drag gestures intended for child components.
  - Fix: Set `scrollEnabled={false}` on outer horizontal tab container, locking tab switches strictly to bottom navigation taps.
  - Added `nestedScrollEnabled={true}` to the Wallets horizontal strip (`SimplizumHero`), Transaction history filter chips (`TransactionHistoryScreen`), and Calendar category chips (`CalendarScreen`).
- **Hardware Back-Button Hijacking on Modals & Child Screens**:
  - Root Cause: `MainTabScreen` registered a global `BackHandler` returning `true` whenever `activeTabIndex !== 0`, even when a child screen (e.g. `AddTransactionScreen`, `GoogleDriveBackupScreen`) was active.
  - Fix: Added `if (!navigation.isFocused()) return false;` guard so back button events correctly pop child screens and dismiss modals.
- **Calendar 7-Column Subpixel Grid Wrapping**:
  - Root Cause: Fixed integer calculation `Math.floor((screenWidth - 32) / 7)` omitted container borders, exceeding available width by 1px on 390px-wide devices (e.g., iPhone 12/13/14) and wrapping Sunday or Saturday into a new row.
  - Fix: Replaced fixed pixel widths with exact percentage flex widths (`width: '14.2857%'`) on both weekday headers and day cells.
- **Floating Bottom Navigation & Card Layout Overlays**:
  - Added dynamic safe area insets via `useSafeAreaInsets` to `BottomNavigation` and `QuickAddSheet` to prevent overlap with the OS home indicator and Android 3-button/gesture bars.
  - Added bottom padding (`paddingBottom: 110`) to `AllSectionsScreen` so bottom cards are never covered by floating bars.
  - Added `flexShrink: 1` and `numberOfLines={1}` to dashboard card headers (`SimplizumHeader`, `GoalsDebtsPreview`) to prevent text collisions with action buttons.
  - Added `adjustsFontSizeToFit` and minimum font scales to currency balances in `GoalsDebtsPreview` and `CalendarScreen` to prevent multi-digit number truncation.

### ⚡ Performance & Polish
- Stack navigation card transition spec tuned to 220ms open / 180ms close with `CardStyleInterpolators.forHorizontalIOS` for fluid, instant 60fps page transitions.
- Interactive iOS edge-swipe back navigation enabled across all stack routes.

---

## [1.0.34] — 2026-10-09

### 🚀 New Features
- **Month Financial Calendar (`CalendarScreen`)**:
  - Full-month calendar view mapping daily income, expense, and net cash flow balances.
  - Visual dot badges indicating recurring expenses, subscription charges, and anticipated auto-salary deposits.
  - Interactive daily detail sheet opening on day selection to inspect all transactions on that specific date.
  - Filter chips allowing users to toggle between All Events, Income, Expenses, and Recurring Obligations.

---

## [1.0.33] — 2026-10-08

### 🚀 New Features
- **Google Drive Backup & Cloud Synchronization (`GoogleDriveBackupScreen`)**:
  - Automated and manual database vault backups to personal Google Drive storage.
  - Configurable background backup schedules (Daily, Weekly, Monthly) with Wi-Fi only preferences.
  - Secure OAuth token lifecycle management with encrypted local token caching.
  - Full restore capability from remote Google Drive backup archives with relational SQLite merge resolution.

---

## [1.0.32] — 2026-10-08

### 🐛 Bug Fixes
- **Android Native VoiceModule Type Stability**:
  - Resolved `Float` to `Double` type cast exception in `VoiceModule.java` during `onRmsChanged` audio metering events.
  - Stabilized live microphone volume waveform rendering during continuous voice interaction.

---

## [1.0.31] — 2026-10-07

### 🚀 New Features
- **Unified Goals & Debts Hub (`GoalsDebtsHubScreen`)**:
  - Consolidated savings targets and debt liabilities into a single, cohesive balance ledger.
  - Visual progress indicators, target completion projections, and payment milestone logs.
- **Persistent Global Number Privacy**:
  - One-tap privacy toggle hiding monetary balances across all screens and cards, preserved globally across app restarts.
- **Persistent Bottom Navigation Quick-Add**:
  - Central `+` button in bottom navigation opening a rapid entry action sheet for transactions, goals, or wallets.

---

## [1.0.30] — 2026-10-07

### 🚀 New Features
- **LAYA Local Classifier Engine**:
  - Integrated local fast-path heuristic classifier for instantaneous transaction auto-categorization without network latency.
- **Native Speech Synthesis (TTS)**:
  - Added native speech synthesis allowing LAYA to provide audible voice responses to user prompts.

### 🐛 Bug Fixes
- Resolved text wrapping and chat bubble overflow issues on small mobile displays.

---

## [1.0.29] — 2026-10-06

### 🚀 New Features
- **LAYA Autonomous Financial Agent**:
  - Comprehensive rebuild of LAYA assistant utilizing Gemini function calling with direct read/write access to the SQLite relational database.
  - Generative UI charts inside chat messages for visual spending analysis.
  - Live full-duplex interactive voice calling with real-time waveform visualization.

---

## [1.0.28] — 2026-10-05

### 🚀 New Features
- **Human-In-The-Loop Approval Engine**:
  - Interactive approval workflow for recurring bills, subscription renewals, and auto-salary deposits.
  - Actionable push notifications allowing users to confirm, edit, or defer payments directly from lock-screen notifications.

---

## [1.0.27] — 2026-10-04

### 🚀 New Features
- **Auto-Salary Deduplication & Arrival Estimation**:
  - Intelligent deduplication engine preventing accidental double-posting of recurring salary deposits.
  - Configurable estimated arrival time window for payroll cycles.

---

## [1.0.26] — 2026-10-03

### 🚀 New Features
- **Dynamic AI Model Selector**:
  - Configurable Gemini engine selector in Settings: Gemini 1.5 Flash, Gemini 2.5 Flash, and Gemini 1.5 Pro.
- **Universal ISO Currency Codes**:
  - Standard ISO 4217 currency formatting with automatic exchange rate conversion and offline currency tables.

---

## [1.0.23 – 1.0.25] — 2026-10-01 to 2026-10-02

### 🎨 Design & UI
- **Simplizum Architectural Redesign**:
  - Cohesive minimalist visual design across all 16 screen directories.
  - Bespoke Simplizum dialog and confirmation system replacing stock OS `Alert.alert`.
  - Unified persistent bottom navigation bar.

---

## [1.0.0 – 1.0.22] — Core Architectural Foundation

### 🏛️ Foundation & System Architecture
- **Three-Vault Financial Paradigm**:
  - **Main Vault**: Everyday operational spending.
  - **Savings Vault**: Protected capital reserves.
  - **Held Vault**: Escrow, deposits, and third-party commitments.
- **Local-First SQLite Relational Ledger**:
  - 9 relational tables with migration management, foreign keys, and atomic balance computation.
- **MMKV High-Speed KV Caching**:
  - Sub-millisecond state persistence for preferences, auth tokens, and session state.
- **Hardware Biometrics & Security**:
  - Face ID, Touch ID, Android BiometricPrompt, and secondary PIN fallback with customizable auto-lock intervals.
- **Full Data Portability**:
  - Complete encrypted ZIP vault export and tabular CSV exports for external spreadsheet auditing.
