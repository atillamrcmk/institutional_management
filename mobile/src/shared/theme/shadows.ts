import { Platform, type ViewStyle } from 'react-native';

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

function createShadow(
  offsetY: number,
  opacity: number,
  radius: number,
  elevation: number,
): ShadowStyle {
  return Platform.select({
    ios: {
      shadowColor: '#0F172A',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
    android: { elevation },
    default: { elevation },
  }) as ShadowStyle;
}

export const shadows = {
  none: {} as ShadowStyle,
  sm: createShadow(1, 0.05, 3, 2),
  md: createShadow(4, 0.08, 12, 4),
  lg: createShadow(8, 0.12, 24, 8),
};
