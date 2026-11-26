import React, { useRef, useEffect, useState } from 'react';
import { View, Image, StyleSheet, Platform } from 'react-native';

interface LoginHeroVideoProps {
  style?: any;
}

export const LoginHeroVideo: React.FC<LoginHeroVideoProps> = ({ style }) => {
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'web' && videoRef.current) {
      // Ensure muted and autoplay succeed across all browsers (Chrome, Safari, iOS Web, Edge)
      videoRef.current.muted = true;
      videoRef.current.setAttribute('muted', '');
      videoRef.current.setAttribute('playsinline', '');
      videoRef.current.setAttribute('autoplay', '');
      videoRef.current.setAttribute('loop', '');
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Retry playback on user interaction if browser policy demands it
          const playOnInteraction = () => {
            if (videoRef.current) {
              videoRef.current.play().catch(() => {});
            }
            window.removeEventListener('click', playOnInteraction);
            window.removeEventListener('touchstart', playOnInteraction);
          };
          window.addEventListener('click', playOnInteraction, { once: true });
          window.addEventListener('touchstart', playOnInteraction, { once: true });
        });
      }
    }
  }, []);

  if (Platform.OS === 'web' && !videoFailed) {
    return (
      <View style={[styles.container, style]}>
        {React.createElement('video', {
          ref: videoRef,
          src: '/login.mp4?v=indiride',
          autoPlay: true,
          loop: true,
          muted: true,
          playsInline: true,
          controls: false,
          preload: 'auto',
          onError: () => setVideoFailed(true),
          style: {
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 20,
            display: 'block',
            backgroundColor: '#0f172a',
          },
        })}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        source={require('../../assets/goride_hero.jpg')}
        style={styles.fallbackImage}
        resizeMode="cover"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#0f172a',
  },
  fallbackImage: {
    width: '100%',
    height: '100%',
  },
});
