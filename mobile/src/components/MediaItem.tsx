import React from 'react';
import { StyleProp, ImageStyle, ViewStyle } from 'react-native';
import { ResizeMode } from 'expo-av';
import { SmartImage } from './SmartImage';
import { VideoPlayer } from './VideoPlayer';

type Props = {
  uri: string;
  type?: string;
  thumbnailUrl?: string;
  style?: StyleProp<ImageStyle & ViewStyle>;
  autoPlay?: boolean;
  muted?: boolean;
  onLoad?: () => void;
  onDurationChange?: (durationMs: number) => void;
  onPlaybackFinish?: () => void;
};

export const MediaItem: React.FC<Props> = ({
  uri,
  type,
  thumbnailUrl,
  style,
  autoPlay = false,
  muted = true,
  onLoad,
  onDurationChange,
  onPlaybackFinish,
}) => {
  const isVideo = type === 'video' || uri?.match(/\.(mp4|mov|avi|webm)$/i);

  if (isVideo) {
    return (
      <VideoPlayer
        uri={uri}
        thumbnail={thumbnailUrl}
        style={style as StyleProp<ViewStyle>}
        autoPlay={autoPlay}
        muted={muted}
        resizeMode={ResizeMode.COVER}
        onDurationChange={onDurationChange}
        onPlaybackFinish={onPlaybackFinish}
      />
    );
  }

  return (
    <SmartImage
      uri={uri}
      style={style as StyleProp<ImageStyle>}
      onLoad={onLoad}
    />
  );
};
