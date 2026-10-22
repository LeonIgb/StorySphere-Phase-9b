import React, { createContext, useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme/theme';

// Shared screen shell: cream background plus safe-area padding on every side the system covers
// (status bar and notch on top, rounded corners and landscape cutouts on the sides).
//
// The bottom inset (gesture bar or three-button navigation bar) is added here only when no tab bar
// is shown, because the tab bar adds it itself. RootNavigator provides `false` while the tab bar is
// visible. Outside the navigator (sign-in, loading) the default `true` applies.
export const BottomInsetContext = createContext(true);

export default function ScreenContainer({ children, style }) {
  const insets = useSafeAreaInsets();
  const padBottom = useContext(BottomInsetContext);
  return (
    <View
      style={[
        styles.base,
        { paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: padBottom ? insets.bottom : 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { flex: 1, backgroundColor: colors.cream100 },
});
