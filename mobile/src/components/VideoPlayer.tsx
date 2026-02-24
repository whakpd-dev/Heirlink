import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { SmartImage } from './SmartImage';
import { API_URL } from '../config';

function resolveUri(uri: string): string {
  if (!uri || typeof uri !== 'string') return '';
  const trimmed = uri.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    if (trimmed.includes('localhost:3000')) {
      return trimmed.replace(/http:\/\/localhost:3000/g, 'https://api.whakcomp.ru');
    }
    return trimmed;
  }
  const base = (API_URL || '').replace(/\/$/, '');
  return trimmed.startsWith('/') ? `${base}${trimmed}` : `${base}/${trimmed}`;
}

type Props = {
  uri: string;
  thumbnail?: string;
  autoPlay?: boolean;
  muted?: boolean;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ResizeMode;
  onDurationChange?: (durationMs: number) => void;
  onPlaybackFinish?: () => void;
};

export const VideoPlayer: React.FC<Props> = ({
  uri,
  thumbnail,
  autoPlay = false,
  muted: initialMuted = true,
  style,
  resizeMode = ResizeMode.COVER,
  onDurationChange,
  onPlaybackFinish,
}) => {
  const videoRef = useRef<Video>(null);
  const isFocused = useIsFocused();
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [isLoading, setIsLoading] = useState(true);
  const [showControls, setShowControls] = useState(!autoPlay);
  const [hasStarted, setHasStarted] = useState(autoPlay);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout>>();

  const resolved = resolveUri(uri);

  useEffect(() => {
    if (!isFocused && videoRef.current) {
      videoRef.current.pauseAsync().catch(() => {});
      setIsPlaying(false);
    }
  }, [isFocused]);

  const onPlaybackStatusUpdate = useCallback(
    (status: AVPlaybackStatus) => {
      if (!status.isLoaded) return;
      setIsPlaying(status.isPlaying);
      setIsLoading(status.isBuffering);
      if (status.durationMillis && onDurationChange) {
        onDurationChange(status.durationMillis);
      }
      if (status.didJustFinish) {
        onPlaybackFinish?.();
        setShowControls(true);
      }
    },
    [onDurationChange, onPlaybackFinish],
  );

  const togglePlay = useCallback(async () => {
    if (!videoRef.current) return;
    if (!hasStarted) {
      setHasStarted(true);
    }
    if (isPlaying) {
      await videoRef.current.pauseAsync();
      setShowControls(true);
    } else {
      await videoRef.current.playAsync();
      setShowControls(false);
      clearTimeout(controlsTimeout.current);
    }
  }, [isPlaying, hasStarted]);

  const handleTap = useCallback(() => {
    if (!hasStarted) {
      togglePlay();
      return;
    }
    setShowControls(true);
    clearTimeout(controlsTimeout.current);
    if (isPlaying) {
      controlsTimeout.current = setTimeout(() => setShowControls(false), 2500);
    }
  }, [hasStarted, isPlaying, togglePlay]);

  const toggleMute = useCallback(async () => {
    if (!videoRef.current) return;
    const next = !isMuted;
    setIsMuted(next);
    await videoRef.current.setIsMutedAsync(next);
  }, [isMuted]);

  if (!hasStarted && thumbnail) {
    return (
      <TouchableOpacity style={[styles.container, style]} onPress={togglePlay} activeOpacity={0.9}>
        <SmartImage uri={thumbnail} style={StyleSheet.absoluteFill as any} />
        <View style={styles.playOverlay}>
          <View style={styles.playCircle}>
            <Ionicons name="play" size={32} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleTap}
      activeOpacity={1}
    >
      <Video
        ref={videoRef}
        source={{ uri: resolved }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        shouldPlay={autoPlay && isFocused}
        isMuted={isMuted}
        isLooping={autoPlay}
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        onLoad={() => setIsLoading(false)}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}

      {showControls && hasStarted && (
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playCircle}>
            <Ionicons
              name={isPlaying ? 'pause' : 'play'}
              size={32}
              color="#FFF"
              style={!isPlaying ? { marginLeft: 3 } : undefined}
            />
          </View>
        </View>
      )}

      {showControls && hasStarted && (
        <TouchableOpacity
          style={styles.muteButton}
          onPress={toggleMute}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.muteCircle}>
            <Ionicons
              name={isMuted ? 'volume-mute' : 'volume-high'}
              size={16}
              color="#FFF"
            />
          </View>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  muteButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
  },
  muteCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
