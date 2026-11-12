// react-native-safe-area-context for component/screen tests (jsdom): no notch.
const React = require('react');
const { View } = require('react-native');

const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const frame = { x: 0, y: 0, width: 400, height: 800 };

module.exports = {
  SafeAreaView: ({ children, style }) => React.createElement(View, { style }, children),
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => insets,
  useSafeAreaFrame: () => frame,
  initialWindowMetrics: { insets, frame },
};
