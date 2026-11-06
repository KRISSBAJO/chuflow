import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, shadow, space } from '@/constants/theme';
import { Icon } from './icon';
import { tap } from './ui';

type ToastMessage = { id: number; kind: 'success' | 'error' | 'info'; text: string };

let listener: ((message: ToastMessage) => void) | null = null;
let nextId = 1;

function show(kind: ToastMessage['kind'], text: string) {
  listener?.({ id: nextId++, kind, text });
}

/** Short confirmation banner at the top of the screen. */
export const toast = {
  success: (text: string) => show('success', text),
  error: (text: string) => show('error', text),
  info: (text: string) => show('info', text),
};

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const [offset] = useState(() => new Animated.Value(-120));

  useEffect(() => {
    listener = (next) => {
      tap(next.kind === 'error' ? 'warning' : next.kind === 'success' ? 'success' : 'light');
      setMessage(next);
    };
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!message) return;
    Animated.spring(offset, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 180 }).start();
    const timer = setTimeout(() => {
      Animated.timing(offset, { toValue: -120, duration: 220, useNativeDriver: true }).start(() =>
        setMessage((current) => (current?.id === message.id ? null : current)),
      );
    }, 2800);
    return () => clearTimeout(timer);
  }, [message, offset]);

  if (!message) return null;
  const tint = message.kind === 'error' ? colors.danger : message.kind === 'success' ? colors.success : colors.ink;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { top: insets.top + space.sm, transform: [{ translateY: offset }] }]}
    >
      <View style={styles.toast}>
        <View style={[styles.icon, { backgroundColor: tint }]}>
          <Icon name={message.kind === 'error' ? 'alert' : 'check'} size={14} color="#ffffff" strokeWidth={2.4} />
        </View>
        <Text style={styles.text}>{message.text}</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: space.lg, right: space.lg, zIndex: 100, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    maxWidth: 440,
    backgroundColor: '#ffffff',
    borderRadius: radius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    ...shadow.lifted,
  },
  icon: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  text: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink },
});
