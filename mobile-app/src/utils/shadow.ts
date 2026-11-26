import { Platform, ViewStyle } from 'react-native';

/**
 * Cross-platform shadow helper.
 * On Web: uses modern CSS `boxShadow` to prevent React Native Web "shadow* style props are deprecated" warnings.
 * On iOS/Android: uses native shadowColor, shadowOffset, shadowOpacity, shadowRadius, and elevation.
 */
export function shadow(
  x: number = 0,
  y: number = 2,
  blur: number = 8,
  color: string = 'rgba(0, 0, 0, 0.08)',
  elevation: number = 3
): ViewStyle {
  if (Platform.OS === 'web') {
    return {
      boxShadow: `${x}px ${y}px ${blur}px ${color}`,
    } as ViewStyle;
  }
  return {
    shadowColor: color,
    shadowOffset: { width: x, height: y },
    shadowOpacity: 0.1,
    shadowRadius: blur,
    elevation,
  };
}
