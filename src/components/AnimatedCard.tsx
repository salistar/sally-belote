import React, { useRef, useEffect } from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  Image,
  Easing,
} from 'react-native';
import { Card } from '../game/beloteEngine';
import { getCardImage, getCardBackImage } from '../game/cardAssets';

interface AnimatedCardProps {
  card?: Card;
  faceDown?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  selected?: boolean;
  size?: 'small' | 'medium' | 'large';
  style?: object;
  animateEntry?: boolean;
  entryDelay?: number;
  animateFlip?: boolean;
  // --- API alternative (utilisée par l'écran de partie en ligne) ---
  /** Valeur de carte (1..12). Combinée à `suit` pour retrouver l'image. */
  value?: string | number;
  /** Couleur longue ('bastos'|'copas'|'espadas'|'oros'). */
  suit?: string;
  /** Largeur explicite (prioritaire sur `size`). */
  width?: number;
  /** Hauteur explicite (prioritaire sur `size`). */
  height?: number;
  /** 'up' = face visible, 'down' = dos. Alternative à `faceDown`. */
  facing?: 'up' | 'down';
}

const SIZES = {
  small: { width: 50, height: 72 },
  medium: { width: 70, height: 100 },
  large: { width: 90, height: 130 },
};

/** Construit l'id image ({valeur 2-digits}-{suite}) depuis value + suit. */
function buildCardId(value?: string | number, suit?: string): string | null {
  if (value == null || !suit) return null;
  return `${String(value).padStart(2, '0')}-${suit}`;
}

export default function AnimatedCard({
  card,
  faceDown = false,
  onPress,
  disabled = false,
  selected = false,
  size = 'medium',
  style,
  animateEntry = false,
  entryDelay = 0,
  animateFlip = false,
  value,
  suit,
  width,
  height,
  facing,
}: AnimatedCardProps) {
  // Dimensions : width/height explicites prioritaires, sinon preset `size`.
  const dimensions = (width && height) ? { width, height } : SIZES[size];
  // faceDown dérivé de `facing` si fourni.
  const isFaceDown = facing ? facing === 'down' : faceDown;
  // id image : depuis `card` ou reconstruit depuis value+suit.
  const resolvedId = card?.id ?? buildCardId(value, suit);
  const entryAnim = useRef(new Animated.Value(animateEntry ? 0 : 1)).current;
  const slideAnim = useRef(new Animated.Value(animateEntry ? 50 : 0)).current;
  const flipAnim = useRef(new Animated.Value(isFaceDown ? 0 : 1)).current;
  const selectAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Entry animation
  useEffect(() => {
    if (animateEntry) {
      Animated.parallel([
        Animated.timing(entryAnim, {
          toValue: 1,
          duration: 400,
          delay: entryDelay,
          easing: Easing.out(Easing.back(1.2)),
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 400,
          delay: entryDelay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [animateEntry, entryDelay]);

  // Flip animation
  useEffect(() => {
    if (animateFlip) {
      Animated.timing(flipAnim, {
        toValue: isFaceDown ? 0 : 1,
        duration: 400,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  }, [isFaceDown, animateFlip]);

  // Selection animation
  useEffect(() => {
    Animated.spring(selectAnim, {
      toValue: selected ? 1 : 0,
      friction: 8,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [selected]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      useNativeDriver: true,
    }).start();
  };

  const imageSource = isFaceDown || !resolvedId
    ? getCardBackImage()
    : getCardImage(resolvedId);

  const translateY = Animated.add(
    slideAnim,
    selectAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -12],
    })
  );

  const cardStyle = {
    opacity: entryAnim,
    transform: [
      { translateY },
      { scale: scaleAnim },
    ],
  };

  const content = (
    <Animated.View
      style={[
        styles.card,
        dimensions,
        cardStyle,
        selected && styles.selectedBorder,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Image
        source={imageSource}
        style={[styles.image, dimensions]}
        resizeMode="contain"
      />
      {selected && <View style={[styles.selectedGlow, dimensions]} />}
    </Animated.View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity
        activeOpacity={1}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  image: {
    borderRadius: 8,
  },
  selectedBorder: {
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  selectedGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
  },
  disabled: {
    opacity: 0.5,
  },
});
