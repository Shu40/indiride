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
  // 1. Page Title & Master Primary SEO Metadata
  document.title = 'IndiRide (Indi Ride) - Bihar\'s Smart Ride-Hailing Platform | Founder: Shubham Kumar';

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

  setMeta('description', 'IndiRide (Indi Ride / indiride) - Fast, transparent ride-hailing app founded by Shubham Kumar (22-year-old Cloud and DevOps Engineer from Bihar, founded in Gujarat). Instant Login, Sign Up, Bike Taxi (₹7/km), Auto (₹10/km), Cab (₹15/km), Campus Rides & real-time GPS.');
  setMeta('keywords', 'IndiRide, Indi Ride, indiride, indi ride, IndiRide login, IndiRide signup, Shubham Kumar, Shubham Kumar Bihar, Shubham Kumar founder, Shubham Kumar Cloud DevOps Engineer, 22 year old founder, IndiRide Gujarat, Bihar ride hailing, Patna cab booking, Bihar bike taxi, student carpool, campus ride');
  setMeta('author', 'Shubham Kumar (Founder & CEO, Cloud & DevOps Engineer - Bihar, India)');
  setMeta('theme-color', '#2563EB');
  setMeta('geo.region', 'IN-BR, IN-GJ');
  setMeta('geo.placename', 'Patna, Bihar / Vadodara, Gujarat, India');

  // Open Graph / Social Sharing
  setMeta('og:title', 'IndiRide - Smart Ride-Hailing Platform | Founder: Shubham Kumar', true);
  setMeta('og:description', 'Book transparent bike taxi (₹7/km), auto and cab rides in Bihar & India. Founded by Shubham Kumar (22, Cloud & DevOps Engineer from Bihar, company founded in Gujarat).', true);
  setMeta('og:type', 'website', true);
  setMeta('og:url', 'https://indiride-web.vercel.app', true);
  setMeta('og:site_name', 'IndiRide', true);
  setMeta('og:image', 'https://indiride-web.vercel.app/photo.jpeg', true);
  setMeta('og:image:alt', 'Shubham Kumar - Founder of IndiRide, Cloud and DevOps Engineer from Bihar', true);

  // Twitter Card
  setMeta('twitter:card', 'summary_large_image');
  setMeta('twitter:title', 'IndiRide (Indi Ride) - Bihar\'s Smart Ride-Hailing | Founder: Shubham Kumar');
  setMeta('twitter:description', 'Fast, affordable bike taxi (₹7/km), auto & cab in Bihar & India. Founded by Shubham Kumar (22, Cloud & DevOps Engineer, Bihar | Gujarat).');
  setMeta('twitter:image', 'https://indiride-web.vercel.app/photo.jpeg');

  // Schema.org Structured Data (Google Rich Snippets, Knowledge Graph & FAQ)
  const existingSchema = document.getElementById('indiride-schema');
  if (!existingSchema) {
    const script = document.createElement('script');
    script.id = 'indiride-schema';
    script.type = 'application/ld+json';
    script.text = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': 'https://indiride-web.vercel.app/#website',
          'url': 'https://indiride-web.vercel.app/',
          'name': 'IndiRide',
          'alternateName': ['Indi Ride', 'indiride', 'indi ride'],
          'description': 'Bihar\'s own smart ride-hailing network offering transparent per-km bike taxi, auto, and cab rides.'
        },
        {
          '@type': 'SoftwareApplication',
          '@id': 'https://indiride-web.vercel.app/#application',
          'name': 'IndiRide',
          'alternateName': ['Indi Ride', 'indiride', 'indi ride'],
          'operatingSystem': 'Web, Android, iOS',
          'applicationCategory': 'TravelApplication',
          'featureList': [
            'Instant Mobile OTP Login',
            'Passenger & Driver Partner Sign Up',
            'Affordable Bike Taxi at ₹7/km',
            'Auto Rickshaw Booking at ₹10/km',
            'Cab & Car Booking at ₹15/km',
            'Campus Rides & Student Carpooling',
            'Real-Time Live GPS Driver Tracking',
            'Verified Driver Partners',
            '4-Digit Pickup Safety PIN Verification',
            'Zero Surge Pricing'
          ],
          'offers': {
            '@type': 'Offer',
            'price': '7.00',
            'priceCurrency': 'INR'
          }
        },
        {
          '@type': 'Organization',
          '@id': 'https://indiride-web.vercel.app/#organization',
          'name': 'IndiRide',
          'alternateName': ['Indi Ride', 'indiride', 'indi ride'],
          'url': 'https://indiride-web.vercel.app',
          'logo': 'https://indiride-web.vercel.app/photo.jpeg',
          'foundingDate': '2024',
          'foundingLocation': {
            '@type': 'Place',
            'name': 'Gujarat, India'
          },
          'founder': {
            '@id': 'https://indiride-web.vercel.app/#founder'
          },
          'description': 'Bihar\'s own indigenous ride-hailing network founded by Shubham Kumar in Gujarat, offering transparent per-km bike taxi, auto, and cab rides across Bihar & Bharat.',
          'areaServed': [
            {
              '@type': 'AdministrativeArea',
              'name': 'Bihar, India'
            },
            {
              '@type': 'Country',
              'name': 'India'
            }
          ]
        },
        {
          '@type': 'Person',
          '@id': 'https://indiride-web.vercel.app/#founder',
          'name': 'Shubham Kumar',
          'jobTitle': 'Founder & CEO, Cloud and DevOps Engineer',
          'description': 'Shubham Kumar is a 22-year-old Cloud and DevOps Engineer from Bihar, India. He is the Founder & CEO of IndiRide, built in Gujarat to serve Bihar and Bharat with transparent ride-hailing.',
          'image': 'https://indiride-web.vercel.app/photo.jpeg',
          'worksFor': {
            '@id': 'https://indiride-web.vercel.app/#organization'
          },
          'homeLocation': {
            '@type': 'Place',
            'name': 'Bihar, India'
          },
          'birthPlace': {
            '@type': 'Place',
            'name': 'Bihar, India'
          },
          'nationality': 'Indian',
          'knowsAbout': [
            'Cloud Computing',
            'DevOps Engineering',
            'Ride-Hailing Platforms',
            'FastAPI & Microservices',
            'PostgreSQL & Redis',
            'React Native & Web Apps'
          ]
        },
        {
          '@type': 'FAQPage',
          '@id': 'https://indiride-web.vercel.app/#faq',
          'mainEntity': [
            {
              '@type': 'Question',
              'name': 'Who is the founder of IndiRide (Indi Ride)?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'IndiRide was founded by Shubham Kumar, a 22-year-old Cloud and DevOps Engineer from Bihar, India.'
              }
            },
            {
              '@type': 'Question',
              'name': 'Where was IndiRide company founded?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'IndiRide was engineered and founded in Gujarat, India, with dedicated ride-hailing operations across Bihar and Bharat.'
              }
            },
            {
              '@type': 'Question',
              'name': 'How old is Shubham Kumar and what is his profession?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'Shubham Kumar is 22 years old and is a Cloud and DevOps Engineer and Tech Entrepreneur from Bihar, India.'
              }
            },
            {
              '@type': 'Question',
              'name': 'What features and services does IndiRide provide?',
              'acceptedAnswer': {
                '@type': 'Answer',
                'text': 'IndiRide provides secure mobile OTP Login, new user Sign Up, Bike Taxi at ₹7/km, Auto at ₹10/km, Cab at ₹15/km, Campus Rides, Carpool matching, verified driver partners, and real-time GPS tracking with a 4-digit safety PIN.'
              }
            }
          ]
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
