/* eslint-env jest */

jest.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

jest.mock('react-native-gifted-charts', () => {
  const { View } = require('react-native');
  return {
    BarChart: View,
    LineChart: View,
    PieChart: View,
  };
});

jest.mock('react-native-share', () => ({
  open: jest.fn().mockResolvedValue(true),
  shareSingle: jest.fn().mockResolvedValue(true),
  default: {
    open: jest.fn().mockResolvedValue(true),
    shareSingle: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn(),
  launchCamera: jest.fn(),
}));

jest.mock('@bam.tech/react-native-image-resizer', () => ({
  createResizedImage: jest.fn().mockResolvedValue({ uri: 'mock-uri', size: 100 }),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn().mockResolvedValue([]),
}));

jest.mock('react-native-video', () => 'Video');

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(),
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  makeMutable: (val) => ({ value: val }),
}));

jest.mock('react-native-gesture-handler', () => {
  const { View } = require('react-native');
  return {
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    Slider: View,
    Switch: View,
    TextInput: View,
    ToolbarAndroid: View,
    ViewPagerAndroid: View,
    DrawerLayoutAndroid: View,
    WebView: View,
    NativeViewGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    PanGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    GestureHandlerRootView: View,
    default: {},
    Directions: {},
  };
});

jest.mock('react-native-haptic-feedback', () => ({
  trigger: jest.fn(),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve('')),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/mock/docs',
  writeFile: jest.fn().mockResolvedValue(true),
  readFile: jest.fn().mockResolvedValue(''),
  unlink: jest.fn().mockResolvedValue(true),
  exists: jest.fn().mockResolvedValue(true),
  mkdir: jest.fn().mockResolvedValue(true),
}));

jest.mock('react-native-biometrics', () => {
  return jest.fn().mockImplementation(() => ({
    isSensorAvailable: jest.fn().mockResolvedValue({ available: true, biometryType: 'Biometrics' }),
    simplePrompt: jest.fn().mockResolvedValue({ success: true }),
  }));
});

jest.mock('react-native-reanimated', () => {
  const { View, Text } = require('react-native');
  const Animated = {
    View,
    Text,
    createAnimatedComponent: (c) => c,
  };
  return {
    __esModule: true,
    default: Animated,
    useSharedValue: (val) => ({ value: val }),
    useAnimatedStyle: (fn) => fn(),
    withTiming: (toValue, config, cb) => {
      if (cb) cb(true);
      return toValue;
    },
    withSpring: (toValue) => toValue,
    withRepeat: (anim) => anim,
    withSequence: (...anims) => anims[anims.length - 1],
    withDelay: (delay, anim) => anim,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    Easing: {
      linear: jest.fn(),
      ease: jest.fn(),
      bezier: () => jest.fn(),
    },
  };
});

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
  }),
}));

jest.mock('react-native-sqlite-storage', () => ({
  enablePromise: jest.fn(),
  DEBUG: jest.fn(),
  openDatabase: jest.fn().mockResolvedValue({
    executeSql: jest.fn().mockResolvedValue([{ rows: { length: 0, item: () => ({}) } }]),
    close: jest.fn(),
  }),
  deleteDatabase: jest.fn(),
}));

jest.mock('@react-native-firebase/messaging', () => () => ({
  hasPermission: jest.fn(() => Promise.resolve(true)),
  subscribeToTopic: jest.fn(),
  unsubscribeFromTopic: jest.fn(),
  requestPermission: jest.fn(() => Promise.resolve(true)),
  getToken: jest.fn(() => Promise.resolve('test-token')),
}));

jest.mock('@notifee/react-native', () => ({
  createChannel: jest.fn(),
  displayNotification: jest.fn(),
  AndroidImportance: { HIGH: 4 },
}));

jest.mock('@shopify/flash-list', () => {
  const { View } = require('react-native');
  return {
    FlashList: (props) => {
      const { data, renderItem, ListEmptyComponent, estimatedItemSize, ...rest } = props;
      if (!data || data.length === 0) {
        return ListEmptyComponent ? (typeof ListEmptyComponent === 'function' ? ListEmptyComponent() : ListEmptyComponent) : null;
      }
      return (
        <View {...rest}>
          {data.map((item, index) => renderItem({ item, index }))}
        </View>
      );
    },
  };
});
