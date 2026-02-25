import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
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
  onDurationChange?: (durationMs: number) => void;
  onPlaybackFinish?: () => void;
};

export const VideoPlayer: React.FC<Props> = ({
  uri,
  thumbnail,
  autoPlay = false,
  muted: externalMuted = true,
  style,
  onDurationChange,
  onPlaybackFinish,
}) => {
  const isFocused = useIsFocused();
  const resolved = resolveUri(uri);
  const [hasStarted, setHasStarted] = useState(autoPlay);
  const durationReported = useRef(false);

  const player = useVideoPlayer(resolved, (p) => {
    p.loop = !!autoPlay;
    p.muted = externalMuted;
    if (autoPlay) {
      p.play();
    }
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });
  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const isLoading = status === 'loading';
  const isReady = status === 'readyToPlay';
  const isIdle = status === 'idle';

  useEffect(() => {
    player.muted = externalMuted;
  }, [externalMuted, player]);

  useEffect(() => {
    if (!isFocused && isPlaying) {
      player.pause();
    }
  }, [isFocused, isPlaying, player]);

  useEffect(() => {
    if (isReady && !durationReported.current && onDurationChange && player.duration > 0) {
      durationReported.current = true;
      onDurationChange(player.duration * 1000);
    }
  }, [isReady, onDurationChange, player]);

  useEffect(() => {
    if (status === 'idle' && hasStarted && !player.loop) {
      onPlaybackFinish?.();
    }
  }, [status, hasStarted, player.loop, onPlaybackFinish]);

  const togglePlay = useCallback(() => {
    if (!hasStarted) {
      setHasStarted(true);
    }
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
  }, [isPlaying, hasStarted, player]);

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
      onPress={togglePlay}
      activeOpacity={1}
    >
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
      />

      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFF" />
        </View>
      )}

      {!isPlaying && hasStarted && (
        <View style={styles.playOverlay} pointerEvents="none">
          <View style={styles.playCircle}>
            <Ionicons name="play" size={32} color="#FFF" style={{ marginLeft: 3 }} />
          </View>
        </View>
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
});
