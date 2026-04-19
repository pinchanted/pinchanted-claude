// ============================================================
// PINCHANTED — Onboarding Step 2
// app/(onboarding)/step-2.tsx
// ============================================================

import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { updateProfile } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/auth.store';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectingStyle } from '../../src/types/database.types';

const AVATAR_OPTIONS = [
  { id: 'castle', emoji: '🏰', label: 'Castle' },
  { id: 'star', emoji: '⭐', label: 'Star' },
  { id: 'crown', emoji: '👑', label: 'Crown' },
  { id: 'magic', emoji: '✨', label: 'Magic' },
  { id: 'mouse', emoji: '🐭', label: 'Mouse' },
  { id: 'heart', emoji: '💖', label: 'Heart' },
  { id: 'rainbow', emoji: '🌈', label: 'Rainbow' },
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'flower', emoji: '🌸', label: 'Flower' },
];

const STYLE_OPTIONS: {
  value: CollectingStyle;
  emoji: string;
  label: string;
  description: string;
}[] = [
  {
    value: 'collector',
    emoji: '📌',
    label: 'Collector',
    description: 'I love finding and keeping pins',
  },
  {
    value: 'trader',
    emoji: '🔄',
    label: 'Trader',
    description: 'I love the thrill of trading',
  },
  {
    value: 'buyer',
    emoji: '🛒',
    label: 'Buyer',
    description: 'I prefer buying pins I want',
  },
];

export default function OnboardingStep2() {
  const { profile, refreshProfile } = useAuthStore();
  const [selectedAvatar, setSelectedAvatar] = useState(
    profile?.avatar_style || 'castle'
  );
  const [selectedStyles, setSelectedStyles] = useState<CollectingStyle[]>(
    (profile?.collecting_style as CollectingStyle[]) || []
  );
  const [isLoading, setIsLoading] = useState(false);

  const toggleStyle = (style: CollectingStyle) => {
    setSelectedStyles(prev =>
      prev.includes(style)
        ? prev.filter(s => s !== style)
        : [...prev, style]
    );
  };

  const handleNext = async () => {
    if (selectedStyles.length === 0) {
      Alert.alert(
        'Almost there!',
        'Please select at least one collecting style.'
      );
      return;
    }

    setIsLoading(true);
    const { error } = await updateProfile(profile!.id, {
      avatar_style: selectedAvatar,
      collecting_style: selectedStyles,
    });
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', 'Could not save your details. Please try again.');
      return;
    }

    await refreshProfile();
    router.push('/(onboarding)/step-3');
  };

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '66%' }]} />
          </View>
          <Text style={styles.progressText}>Step 2 of 3</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🎨</Text>
          <Text style={styles.title}>Make it yours!</Text>
          <Text style={styles.subtitle}>
            Choose an avatar and tell us how you like to collect
          </Text>
        </View>

        {/* Avatar selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Choose your avatar</Text>
          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((avatar) => (
              <TouchableOpacity
                key={avatar.id}
                style={[
                  styles.avatarOption,
                  selectedAvatar === avatar.id && styles.avatarOptionSelected,
                ]}
                onPress={() => setSelectedAvatar(avatar.id)}
              >
                <Text style={styles.avatarEmoji}>{avatar.emoji}</Text>
                <Text style={[
                  styles.avatarLabel,
                  selectedAvatar === avatar.id && styles.avatarLabelSelected,
                ]}>
                  {avatar.label}
                </Text>
                {selectedAvatar === avatar.id && (
                  <View style={styles.avatarCheck}>
                    <AntDesign
                      name="check-circle"
                      size={12}
                      color={Colors.gold}
                    />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Collecting style */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>How do you collect?</Text>
          <Text style={styles.sectionHint}>Select all that apply</Text>
          <View style={styles.styleList}>
            {STYLE_OPTIONS.map((option) => {
              const isSelected = selectedStyles.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.styleCard,
                    isSelected && styles.styleCardSelected,
                  ]}
                  onPress={() => toggleStyle(option.value)}
                >
                  <Text style={styles.styleEmoji}>{option.emoji}</Text>
                  <View style={styles.styleText}>
                    <Text style={[
                      styles.styleLabel,
                      isSelected && styles.styleLabelSelected,
                    ]}>
                      {option.label}
                    </Text>
                    <Text style={styles.styleDescription}>
                      {option.description}
                    </Text>
                  </View>
                  <View style={[
                    styles.styleCheckbox,
                    isSelected && styles.styleCheckboxSelected,
                  ]}>
                    {isSelected && (
                      <AntDesign name="check" size={12} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Navigation buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <AntDesign name="left" size={14} color={Colors.textMuted} />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.nextButton}
            onPress={handleNext}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.nextButtonInner}>
                <Text style={styles.nextButtonText}>Next</Text>
                <AntDesign name="right" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.skipHint}>
          You can update these details later in your profile
        </Text>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Theme.screenPadding,
    paddingTop: 60,
    gap: Theme.spacing.xl,
  },

  // Progress
  progressContainer: {
    gap: Theme.spacing.xs,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.gold,
    borderRadius: 2,
  },
  progressText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
  },

  // Header
  header: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  emoji: {
    fontSize: 48,
  },
  title: {
    fontSize: Theme.fontSize.xxl,
    fontWeight: '500',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Card
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  sectionTitle: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.gold,
  },
  sectionHint: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    marginTop: -Theme.spacing.xs,
  },

  // Avatar grid
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  avatarOption: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.xs,
    position: 'relative',
  },
  avatarOptionSelected: {
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderColor: 'rgba(245,197,24,0.4)',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  avatarLabel: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  avatarLabelSelected: {
    color: Colors.gold,
  },
  avatarCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
  },

  // Style options
  styleList: {
    gap: Theme.spacing.sm,
  },
  styleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    gap: Theme.spacing.md,
  },
  styleCardSelected: {
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderColor: 'rgba(245,197,24,0.35)',
  },
  styleEmoji: {
    fontSize: 24,
    flexShrink: 0,
  },
  styleText: {
    flex: 1,
    gap: 2,
  },
  styleLabel: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  styleLabelSelected: {
    color: Colors.textPrimary,
  },
  styleDescription: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  styleCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  styleCheckboxSelected: {
    backgroundColor: Colors.crimson,
    borderColor: Colors.crimson,
  },

  // Buttons
  buttonRow: {
    flexDirection: 'row',
    gap: Theme.spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.md,
    paddingHorizontal: Theme.spacing.lg,
  },
  backButtonText: {
    color: Colors.textMuted,
    fontSize: Theme.fontSize.md,
  },
  nextButton: {
    flex: 1,
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  nextButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  nextButtonText: {
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },

  // Skip hint
  skipHint: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
    textAlign: 'center',
  },
});