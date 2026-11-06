import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';

/** "ChuFlow" with the flame swoosh under "Flow", the same mark as the website. */
export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="header" accessibilityLabel="ChuFlow">
      <Text style={[styles.text, { fontSize: size, letterSpacing: -size * 0.045 }]}>Chu</Text>
      <View>
        <Text style={[styles.text, { fontSize: size, letterSpacing: -size * 0.045 }]}>Flow</Text>
        <Svg
          width={size * 2.05}
          height={size * 0.32}
          viewBox="0 0 100 16"
          style={{ position: 'absolute', left: 0, bottom: -size * 0.2 }}
        >
          <Defs>
            <LinearGradient id="wordmark-flame" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor={colors.flameFrom} />
              <Stop offset="1" stopColor={colors.flameTo} />
            </LinearGradient>
          </Defs>
          <Path
            d="M3 10 C 20 3, 36 15, 54 8 S 84 4, 97 7"
            stroke="url(#wordmark-flame)"
            strokeWidth={4}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>
    </View>
  );
}

/** The square app mark: a dark tile with the C and the swoosh. */
export function AppMark({ size = 56 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        <LinearGradient id="mark-flame" x1="0" x2="1" y1="0" y2="0">
          <Stop offset="0" stopColor={colors.flameFrom} />
          <Stop offset="1" stopColor={colors.flameTo} />
        </LinearGradient>
      </Defs>
      <Path d="M16 0h32a16 16 0 0116 16v32a16 16 0 01-16 16H16A16 16 0 010 48V16A16 16 0 0116 0z" fill={colors.ink} />
      <Path d="M41 21.5a13 13 0 1 0 0 17" stroke="#ffffff" strokeWidth={6.5} strokeLinecap="round" fill="none" />
      <Path d="M13 50 C 22 44, 30 54, 38 48 S 50 43, 54 45" stroke="url(#mark-flame)" strokeWidth={4.5} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  text: { fontFamily: fonts.semibold, color: colors.ink },
});
