import '../src/utils/suppressWarnings';
import React, { useEffect } from 'react';
import { Platform, LogBox } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../src/store/authStore';
import { wsService } from '../src/services/websocket';

// Ignore web-only deprecation notices from third-party libraries and React Native Web
LogBox.ignoreLogs([
  '"shadow*" style props are deprecated. Use "boxShadow".',
  'props.pointerEvents is deprecated. Use style.pointerEvents',
  'Animated: `useNativeDriver` is not supported',
]);

if (Platform.OS === 'web' && typeof console !== 'undefined') {
  const origWarn = console.warn;
  console.warn = (...args: any[]) => {
    const msg = String(args[0] || '');
    if (
      (msg.includes('shadow') && msg.includes('deprecated')) ||
      msg.includes('pointerEvents is deprecated') ||
      msg.includes('useNativeDriver')
    ) {
      return;
    }
    origWarn.apply(console, args);
  };
}

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // 1. Page Title & Primary SEO Metadata
  document.title = 'IndiRide - Bihar\'s Smart Ride-Hailing Platform | Founder: Shubham Kumar';

  const setMeta = (name: string, content: string, isProperty = false) => {
    const attr = isProperty ? 'property' : 'name';
    let el = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attr, name);
      document.head.appendChild(el);
    }
    el.content = content;
  };

  setMeta('description', 'IndiRide (Indi Ride) - Fast, reliable & affordable bike taxi (₹7/km), auto and cab rides in Bihar & India. Founded by Shubham Kumar. Verified drivers, real-time GPS & 4-digit pickup safety PIN.');
  setMeta('keywords', 'IndiRide, Indi Ride, indiride, indi ride, Shubham Kumar, Bihar ride hailing, Patna cab booking, Bihar bike taxi, Rapido Bihar, Ola Uber Bihar, student ride, safe rides Bihar, auto booking');
  setMeta('author', 'Shubham Kumar (Founder & CEO, IndiRide - Bihar, India)');
  setMeta('theme-color', '#2563EB');

  // Open Graph / Social Sharing
  setMeta('og:title', 'IndiRide - Bihar\'s Own Ride-Hailing Platform | Founder Shubham Kumar', true);
  setMeta('og:description', 'Book bike taxi (₹7/km), auto and cab rides across Bihar & Bharat. Built by Shubham Kumar with zero surge exploitation & guaranteed pickup PIN safety.', true);
  setMeta('og:type', 'website', true);
  setMeta('og:url', 'https://indiride.com', true);
  setMeta('og:site_name', 'IndiRide', true);

  // Twitter Card
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', 'IndiRide - Bihar\'s Smart Ride-Hailing Platform | Founder Shubham Kumar');
  setMeta('twitter:description', 'Fast, affordable bike taxi (₹7/km), auto & cab rides in Bihar & India. Real-time GPS & verified drivers.');

  // Schema.org Structured Data (Organization + Founder + Bihar roots)
  const existingSchema = document.getElementById('indiride-schema');
  if (!existingSchema) {
    const script = document.createElement('script');
    script.id = 'indiride-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': 'https://indiride.com/#organization',
          'name': 'IndiRide',
          'alternateName': ['Indi Ride', 'indiride', 'indi ride'],
          'url': 'https://indiride.com',
          'logo': 'https://indiride.com/icon.png',
          'foundingDate': '2024',
          'foundingLocation': {
            '@type': 'Place',
            'name': 'Bihar, India'
          },
          'founder': {
            '@type': 'Person',
            'name': 'Shubham Kumar',
            'jobTitle': 'Founder & CEO',
            'homeLocation': {
              '@type': 'Place',
              'name': 'Bihar, India'
            }
          },
          'description': 'Bihar\'s own indigenous ride-hailing network offering transparent per-km bike taxi, auto, and cab rides.',
          'areaServed': 'India'
        },
        {
          '@type': 'Person',
          '@id': 'https://indiride.com/#founder',
          'name': 'Shubham Kumar',
          'jobTitle': 'Founder & CEO',
          'worksFor': {
            '@id': 'https://indiride.com/#organization'
          },
          'homeLocation': {
            '@type': 'Place',
            'name': 'Bihar, India'
          },
          'nationality': 'Indian'
        }
      ]
    });
    document.head.appendChild(script);
  }

  const styleEl = document.createElement('style');
  styleEl.innerHTML = `
    html, body, #root {
      width: 100% !important;
      height: 100% !important;
      margin: 0 !important;
      padding: 0 !important;
      overflow-x: hidden !important;
      background-color: #ffffff !important;
      -webkit-font-smoothing: antialiased;
    }
    /* Completely eliminate browser user-agent black box / focus outlines on all inputs */
    input, textarea, select {
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      -webkit-tap-highlight-color: transparent !important;
      box-shadow: none !important;
    }
    input:focus, textarea:focus, select:focus,
    input:focus-visible, textarea:focus-visible,
    input:active, textarea:active {
      outline: none !important;
      outline-width: 0 !important;
      outline-style: none !important;
      box-shadow: none !important;
    }
    *:focus, *:focus-visible {
      outline: none !important;
      outline-style: none !important;
    }
  `;
  document.head.appendChild(styleEl);
}

const queryClient = new QueryClient();

export default function RootLayout() {
  const { initialize, isAuthenticated, logout } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    const unbind = wsService.subscribe('auth_error', () => {
      logout();
    });
    return () => unbind();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      wsService.connect();
    } else {
      wsService.disconnect();
    }
  }, [isAuthenticated]);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="(passenger)/index" />
          <Stack.Screen name="(rider)/index" />
          <Stack.Screen name="(admin)/index" />
        </Stack>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
