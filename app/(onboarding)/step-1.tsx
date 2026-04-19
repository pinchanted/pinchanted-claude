// ============================================================
// PINCHANTED — Onboarding Step 1
// app/(onboarding)/step-1.tsx
// ============================================================

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { updateProfile, checkUsernameAvailable } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/auth.store';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';
import { CollectingExperience } from '../../src/types/database.types';

const EXPERIENCE_OPTIONS: {
  value: CollectingExperience;
  label: string;
  emoji: string;
  description: string;
}[] = [
  {
    value: 'under-1',
    label: 'Just starting out',
    emoji: '🌱',
    description: 'Less than a year collecting',
  },
  {
    value: '1-2',
    label: 'Getting the hang of it',
    emoji: '⭐',
    description: '1–2 years collecting',
  },
  {
    value: '2-5',
    label: 'Experienced collector',
    emoji: '🌟',
    description: '2–5 years collecting',
  },
  {
    value: '5-plus',
    label: 'Veteran collector',
    emoji: '👑',
    description: '5+ years collecting',
  },
];

export default function OnboardingStep1() {
  const { profile, refreshProfile } = useAuthStore();
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [experience, setExperience] = useState<CollectingExperience | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleUsernameChange = async (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);

    // Don't check if it's the same as their current username
    if (cleaned === profile?.username) {
      setUsernameAvailable(true);
      return;
    }

    if (cleaned.length >= 3) {
      setCheckingUsername(true);
      const { available } = await checkUsernameAvailable(cleaned);
      setUsernameAvailable(available);
      setCheckingUsername(false);
    } else {
      setUsernameAvailable(null);
    }
  };

  const handleNext = async () => {
    if (!displayName.trim()) {
      Alert.alert('Missing name', 'Please enter your display name.');
      return;
    }
    if (!username || username.length < 3) {
      Alert.alert('Invalid username', 'Username must be at least 3 characters.');
      return;
    }
    if (usernameAvailable === false) {
      Alert.alert('Username taken', 'Please choose a different username.');
      return;
    }
    if (!experience) {
      Alert.alert('Almost there!', 'Please tell us how long you have been collecting.');
      return;
    }

    setIsLoading(true);
    const { error } = await updateProfile(profile!.id, {
      display_name: displayName.trim(),
      username,
      collecting_experience: experience,
    });
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', 'Could not save your details. Please try again.');
      return;
    }

    await refreshProfile();
    router.push('/(onboarding)/step-2');
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
            <View style={[styles.progressFill, { width: '33%' }]} />
          </View>
          <Text style={styles.progressText}>Step 1 of 3</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>👋</Text>
          <Text style={styles.title}>Let's get to know you!</Text>
          <Text style={styles.subtitle}>
            Tell us a bit about yourself and your collecting journey
          </Text>
        </View>

        {/* Card */}
        <View style={styles.card}>

          {/* Display name */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Display name</Text>
            <View style={styles.inputWrapper}>
              <AntDesign
                name="user"
                size={14}
                color="rgba(255,255,255,0.4)"
              />
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="How should we call you?"
                placeholderTextColor={Colors.textPlaceholder}
                autoCapitalize="words"
                autoComplete="off"
              />
            </View>
          </View>

          {/* Username */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Username</Text>
            <View style={[
              styles.inputWrapper,
              usernameAvailable === true && styles.inputValid,
              usernameAvailable === false && styles.inputInvalid,
            ]}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={handleUsernameChange}
                placeholder="your_username"
                placeholderTextColor={Colors.textPlaceholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
              />
              {checkingUsername && (
                <ActivityIndicator size="small" color={Colors.gold} />
              )}
              {!checkingUsername && usernameAvailable === true && (
                <AntDesign name="check-circle" size={14} color={Colors.success} />
              )}
              {!checkingUsername && usernameAvailable === false && (
                <AntDesign name="close-circle" size={14} color={Colors.error} />
              )}
            </View>
            {usernameAvailable === false && (
              <Text style={styles.fieldError}>Username already taken</Text>
            )}
          </View>

          {/* Collecting experience */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>How long have you been collecting?</Text>
            <View style={styles.experienceGrid}>
              {EXPERIENCE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.experienceCard,
                    experience === option.value && styles.experienceCardSelected,
                  ]}
                  onPress={() => setExperience(option.value)}
                >
                  <Text style={styles.experienceEmoji}>{option.emoji}</Text>
                  <Text style={[
                    styles.experienceLabel,
                    experience === option.value && styles.experienceLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.experienceDescription}>
                    {option.description}
                  </Text>
                  {experience === option.value && (
                    <View style={styles.experienceCheck}>
                      <AntDesign
                        name="check-circle"
                        size={14}
                        color={Colors.gold}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </View>

        {/* Next button */}
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

        {/* Skip hint */}
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
    gap: Theme.spacing.lg,
  },

  // Fields
  fieldContainer: {
    gap: Theme.spacing.sm,
  },
  label: {
    fontSize: Theme.fontSize.sm,
    color: Colors.gold,
    fontWeight: '500',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.18)',
    borderRadius: Theme.radius.md,
    paddingHorizontal: Theme.spacing.md,
    gap: Theme.spacing.sm,
  },
  inputValid: {
    borderColor: Colors.successBorder,
  },
  inputInvalid: {
    borderColor: Colors.errorBorder,
  },
  atSign: {
    fontSize: Theme.fontSize.md,
    color: Colors.gold,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
  },
  fieldError: {
    fontSize: Theme.fontSize.xs,
    color: Colors.error,
  },

  // Experience grid
  experienceGrid: {
    gap: Theme.spacing.sm,
  },
  experienceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
    position: 'relative',
  },
  experienceCardSelected: {
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderColor: 'rgba(245,197,24,0.4)',
  },
  experienceEmoji: {
    fontSize: 24,
    flexShrink: 0,
  },
  experienceLabel: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textSecondary,
    flex: 1,
  },
  experienceLabelSelected: {
    color: Colors.textPrimary,
  },
  experienceDescription: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    position: 'absolute',
    bottom: 8,
    right: 36,
  },
  experienceCheck: {
    flexShrink: 0,
  },

  // Next button
  nextButton: {
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