import { Platform, LogBox } from 'react-native';

LogBox.ignoreLogs([
  '"shadow*" style props are deprecated. Use "boxShadow".',
  'props.pointerEvents is deprecated. Use style.pointerEvents',
  'Animated: `useNativeDriver` is not supported',
]);

if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = args.map((a) => String(a || '')).join(' ');
    if (
      msg.includes('shadow*') ||
      msg.includes('boxShadow') ||
      (msg.includes('shadow') && msg.includes('deprecated')) ||
      msg.includes('pointerEvents is deprecated') ||
      msg.includes('useNativeDriver')
    ) {
      return;
    }
    origWarn.apply(console, args);
  };

  const origError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map((a) => String(a || '')).join(' ');
    if (
      msg.includes('shadow*') ||
      (msg.includes('shadow') && msg.includes('deprecated'))
    ) {
      return;
    }
    origError.apply(console, args);
  };
}

export {};
