// ============================================================
// PINCHANTED — Onboarding Step 3
// app/(onboarding)/step-3.tsx
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
import { PIN_THEMES, DISNEY_PARKS } from '../../src/types/database.types';

export default function OnboardingStep3() {
  const { profile, refreshProfile } = useAuthStore();
  const [selectedThemes, setSelectedThemes] = useState<string[]>(
    profile?.favourite_themes || []
  );
  const [selectedPark, setSelectedPark] = useState<string | null>(
    profile?.favourite_park || null
  );
  const [isLoading, setIsLoading] = useState(false);

  const toggleTheme = (theme: string) => {
    setSelectedThemes(prev =>
      prev.includes(theme)
        ? prev.filter(t => t !== theme)
        : [...prev, theme]
    );
  };

  const handleFinish = async () => {
    if (selectedThemes.length === 0) {
      Alert.alert(
        'Almost there!',
        'Please select at least one favourite theme.'
      );
      return;
    }

    setIsLoading(true);
    const { error } = await updateProfile(profile!.id, {
      favourite_themes: selectedThemes,
      favourite_park: selectedPark,
      collecting_experience: profile?.collecting_experience || 'under-1',
    });
    setIsLoading(false);

    if (error) {
      Alert.alert('Error', 'Could not save your details. Please try again.');
      return;
    }

    await refreshProfile();
    router.replace('/(tabs)');
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
            <View style={[styles.progressFill, { width: '100%' }]} />
          </View>
          <Text style={styles.progressText}>Step 3 of 3</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.emoji}>🏰</Text>
          <Text style={styles.title}>What do you love?</Text>
          <Text style={styles.subtitle}>
            Choose your favourite pin themes and park — this helps us
            personalise your Marketplace and Wishlist
          </Text>
        </View>

        {/* Themes */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Favourite themes</Text>
          <Text style={styles.sectionHint}>Select all that apply</Text>
          <View style={styles.themeGrid}>
            {PIN_THEMES.map((theme) => {
              const isSelected = selectedThemes.includes(theme);
              return (
                <TouchableOpacity
                  key={theme}
                  style={[
                    styles.themeChip,
                    isSelected && styles.themeChipSelected,
                  ]}
                  onPress={() => toggleTheme(theme)}
                >
                  {isSelected && (
                    <AntDesign
                      name="check"
                      size={11}
                      color={Colors.gold}
                    />
                  )}
                  <Text style={[
                    styles.themeChipText,
                    isSelected && styles.themeChipTextSelected,
                  ]}>
                    {theme}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Favourite park */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Favourite Disney park</Text>
          <Text style={styles.sectionHint}>Optional — select one</Text>
          <View style={styles.parkList}>
            {DISNEY_PARKS.map((park) => {
              const isSelected = selectedPark === park;
              return (
                <TouchableOpacity
                  key={park}
                  style={[
                    styles.parkRow,
                    isSelected && styles.parkRowSelected,
                  ]}
                  onPress={() =>
                    setSelectedPark(isSelected ? null : park)
                  }
                >
                  <Text style={[
                    styles.parkName,
                    isSelected && styles.parkNameSelected,
                  ]}>
                    {park}
                  </Text>
                  {isSelected && (
                    <AntDesign
                      name="check-circle"
                      size={16}
                      color={Colors.gold}
                    />
                  )}
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
            style={styles.finishButton}
            onPress={handleFinish}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.finishButtonInner}>
                <Text style={styles.finishButtonText}>
                  Let's go! ✨
                </Text>
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

  // Theme chips
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Theme.spacing.sm,
  },
  themeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: Theme.radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  themeChipSelected: {
    backgroundColor: 'rgba(245,197,24,0.12)',
    borderColor: 'rgba(245,197,24,0.45)',
  },
  themeChipText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },
  themeChipTextSelected: {
    color: Colors.gold,
    fontWeight: '500',
  },

  // Parks
  parkList: {
    gap: Theme.spacing.sm,
  },
  parkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
  },
  parkRowSelected: {
    backgroundColor: 'rgba(245,197,24,0.08)',
    borderColor: 'rgba(245,197,24,0.35)',
  },
  parkName: {
    fontSize: Theme.fontSize.md,
    color: Colors.textSecondary,
    flex: 1,
  },
  parkNameSelected: {
    color: Colors.textPrimary,
    fontWeight: '500',
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
  finishButton: {
    flex: 1,
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  finishButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  finishButtonText: {
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