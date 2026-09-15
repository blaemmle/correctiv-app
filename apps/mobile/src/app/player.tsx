import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { ProgressBar } from '@/components/player/ProgressBar';
import { SafeAreaView, Typo } from '@/components/ui';
import { formatTimeHm } from '@correctiv/app-core/lib/format';
import { seekTo, setSpeed, togglePlay } from '@/lib/audio/player';
import { useAudio } from '@/lib/audio/useAudio';
import { goBack } from '@/lib/navigation/goBack';
import { useDocumentTitle } from '@/lib/navigation/documentTitle';
import { sizes, useColors } from '@/lib/theme';

const SPEEDS = [1, 1.2, 1.5];

/**
 * The full player, as a modal. It shows the same singleton as the mini bar — there
 * is no second state and no second instance; the modal is only a larger view of it.
 */
export default function PlayerScreen() {
  // A modal over whatever it was opened from, and therefore a route with a tab of
  // its own on the web target. It has no `ScreenHeader` to name it (ADR 0030).
  useDocumentTitle('Player');
  const colors = useColors();
  const { track, status, positionSec, durationSec, speed, errorMessage } = useAudio();
  const live = track?.kind === 'radio';

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-canvas">
      <View className="flex-row px-s py-2xs">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Player schließen"
          onPress={goBack}
          hitSlop={8}
          className="items-center justify-center active:opacity-70"
          style={{ width: sizes.iconButton, height: sizes.iconButton }}
        >
          <Ionicons name="close" size={24} color={colors['on-canvas']} />
        </Pressable>
      </View>

      {!track ? (
        <View className="flex-1 items-center justify-center px-m">
          <Typo variant="text-m" color="on-canvas-muted">
            Es läuft gerade nichts.
          </Typo>
        </View>
      ) : (
        <>
          <View className="flex-1 justify-center px-m">
            <View
              className="items-center justify-center self-center rounded-md bg-surface"
              style={{ width: 180, height: 180 }}
            >
              <Ionicons
                name={live ? 'radio' : 'headset'}
                size={56}
                color={live ? colors.accent : colors['grey-500']}
              />
            </View>
            <Typo variant="headline-l" className="mt-m">
              {track.title}
            </Typo>
            <Typo variant="text-s" color={live ? 'accent' : 'on-canvas-muted'} className="mt-2xs">
              {live ? '● LIVE · 24/7 aus Bottrop' : (track.subtitle ?? '')}
            </Typo>
            {status === 'error' && (
              <Typo variant="text-s" color="accent" className="mt-s">
                {errorMessage}
              </Typo>
            )}
          </View>

          <View className="px-m pb-m">
            {live ? (
              <Typo variant="text-s" color="on-canvas-muted" className="mb-s">
                Livestream. Salon5 sendet rund um die Uhr.
              </Typo>
            ) : (
              <>
                <ProgressBar
                  positionSec={positionSec}
                  durationSec={durationSec}
                  onSeek={(seconds) => void seekTo(seconds)}
                />
                <View className="flex-row justify-between">
                  <Typo variant="text-s" color="grey-500">
                    {formatTimeHm(positionSec)}
                  </Typo>
                  <Typo variant="text-s" color="grey-500">
                    {formatTimeHm(durationSec)}
                  </Typo>
                </View>
              </>
            )}

            <View className="mt-s flex-row items-center justify-center">
              {!live && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Geschwindigkeit wechseln"
                  onPress={() => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length])}
                  hitSlop={8}
                  className="absolute left-0 active:opacity-70"
                >
                  <Typo variant="text-m" weight="semibold" color="on-canvas-muted">
                    {speed}×
                  </Typo>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={status === 'playing' ? 'Pausieren' : 'Abspielen'}
                onPress={togglePlay}
                className="items-center justify-center rounded-full bg-accent active:opacity-80"
                style={{ width: sizes.playButtonLarge, height: sizes.playButtonLarge }}
              >
                {status === 'loading' ? (
                  <ActivityIndicator color={colors['always-light']} />
                ) : (
                  <Ionicons
                    name={status === 'playing' ? 'pause' : 'play'}
                    size={28}
                    color={colors['always-light']}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
