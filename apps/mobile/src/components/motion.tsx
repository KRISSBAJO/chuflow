import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

/*
 * The app's two motions. PressableScale answers every tap by easing the control down a touch
 * and back; Reveal lets a block rise and fade in when a screen opens. Both run on the plain
 * Animated API so they behave the same on iOS, Android and the web preview.
 */

const native = Platform.OS !== 'web';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Scale while pressed; 0.97 for cards and buttons, closer to 1 for full-width rows. */
  scaleTo?: number;
  /** Opacity while pressed, relative to `baseOpacity`. */
  dim?: number;
  /** Resting opacity, e.g. 0.4 for a disabled button. */
  baseOpacity?: number;
};

export function PressableScale({ style, scaleTo = 0.97, dim = 0.85, baseOpacity = 1, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const [press] = useState(() => new Animated.Value(0));
  const to = (value: number) =>
    Animated.timing(press, { toValue: value, duration: value ? 90 : 200, easing: Easing.out(Easing.quad), useNativeDriver: native }).start();
  const scale = press.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] });
  const opacity = press.interpolate({ inputRange: [0, 1], outputRange: [baseOpacity, baseOpacity * dim] });
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        to(1);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        to(0);
        onPressOut?.(event);
      }}
      style={[style, { transform: [{ scale }], opacity }]}
    />
  );
}

/** Fades and rises its children in once, `delay` ms after mounting; stagger blocks with increasing delays. */
export function Reveal({ children, delay = 0, distance = 14, style }: { children: ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle> }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 1, duration: 440, delay, easing: Easing.out(Easing.cubic), useNativeDriver: native });
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);
  return (
    <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}
