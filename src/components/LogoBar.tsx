import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

// Brand banner shown at the top of every screen. It paints behind the status
// bar (top safe-area inset), so screens using it must NOT include 'top' in
// their SafeAreaView edges.
export function LogoBar() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <Image
        source={require('../../assets/logo_completed_light_background.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityElementsHidden
        importantForAccessibility="no"
        // @ts-ignore — web-only prop; tells the browser not to lazy-load this above-fold image
        loading="eager"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    width: '100%',
    backgroundColor: colors.oliveLogo,
    alignItems: 'center',
  },
  logo: {
    width: '75%',
    maxWidth: 280,
    height: 52,
  },
});
