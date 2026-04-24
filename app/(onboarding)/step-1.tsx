// ============================================================
// PINCHANTED — Onboarding Step 1
// app/(onboarding)/step-1.tsx
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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { updateProfile, uploadAvatarImage } from '../../src/lib/supabase';
import { useAuthStore } from '../../src/stores/auth.store';
import { getCurrentUserId } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
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
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuthStore();
  const [experience, setExperience] = useState<CollectingExperience | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Avatar state
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Please allow access to your photo library to upload a profile photo.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setAvatarBase64(result.assets[0].base64 || null);
    }
  };

  const handleNext = async () => {
    if (!experience) {
      Alert.alert('Almost there!', 'Please tell us how long you have been collecting.');
      return;
    }

    setIsLoading(true);

    let userId = getCurrentUserId() || profile?.id;
    if (!userId) {
      const { data: { session } } = await supabase.auth.getSession();
      userId = session?.user?.id;
    }

    if (!userId) {
      Alert.alert('Error', 'Could not find user. Please sign in again.');
      setIsLoading(false);
      return;
    }

    // Upload avatar if user picked one
    let avatarUrl: string | null = null;
    if (avatarUri && avatarBase64) {
      setUploadingAvatar(true);
      avatarUrl = await uploadAvatarImage(userId, avatarUri, avatarBase64);
      setUploadingAvatar(false);
      if (!avatarUrl) {
        Alert.alert(
          'Photo upload failed',
          'We could not upload your photo. You can add one later in your profile.',
          [{ text: 'Continue anyway', onPress: () => {} }]
        );
      }
    }

    const { error } = await updateProfile(userId, {
      collecting_experience: experience,
      avatar_style: 'castle',
      ...(avatarUrl && { avatar_url: avatarUrl }),
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
        contentContainerStyle={[styles.scrollContent, { paddingTop: 60 + insets.top }]}
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
          <Text style={styles.title}>
            Welcome, {profile?.display_name?.split(' ')[0] || 'Collector'}!
          </Text>
          <Text style={styles.subtitle}>
            Let's set up your profile
          </Text>
        </View>

        {/* Profile photo */}
        <View style={styles.card}>
          <Text style={styles.label}>Profile photo</Text>
          <Text style={styles.cardHint}>
            Add a photo so other collectors can recognise you, or keep the default castle icon.
          </Text>

          <View style={styles.avatarRow}>
            {/* Avatar preview */}
            <TouchableOpacity style={styles.avatarWrap} onPress={pickImage}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarDefault}>
                  <Text style={styles.avatarDefaultEmoji}>🏰</Text>
                </View>
              )}
              <View style={styles.avatarEditBadge}>
                <AntDesign name="camera" size={12} color="#fff" />
              </View>
            </TouchableOpacity>

            {/* Buttons */}
            <View style={styles.avatarButtons}>
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={pickImage}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? (
                  <ActivityIndicator size="small" color={Colors.gold} />
                ) : (
                  <>
                    <AntDesign name="camera" size={15} color={Colors.gold} />
                    <Text style={styles.uploadBtnText}>
                      {avatarUri ? 'Change photo' : 'Upload photo'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {avatarUri && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => {
                    setAvatarUri(null);
                    setAvatarBase64(null);
                  }}
                >
                  <Text style={styles.removeBtnText}>Keep default 🏰</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Collecting experience */}
        <View style={styles.card}>
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
                <View style={styles.experienceText}>
                  <Text style={[
                    styles.experienceLabel,
                    experience === option.value && styles.experienceLabelSelected,
                  ]}>
                    {option.label}
                  </Text>
                  <Text style={styles.experienceDescription}>
                    {option.description}
                  </Text>
                </View>
                {experience === option.value && (
                  <AntDesign name="check-circle" size={16} color={Colors.gold} />
                )}
              </TouchableOpacity>
            ))}
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

        <Text style={styles.skipHint}>
          You can update these details later in your profile
        </Text>

      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Theme.screenPadding,
    gap: Theme.spacing.xl,
  },

  progressContainer: { gap: Theme.spacing.xs },
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

  header: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  emoji: { fontSize: 48 },
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

  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },
  label: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.gold,
  },
  cardHint: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
    marginTop: -Theme.spacing.xs,
  },

  // Avatar
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.lg,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    position: 'relative',
    flexShrink: 0,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.gold,
  },
  avatarDefault: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.royalBlue,
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDefaultEmoji: {
    fontSize: 36,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.crimson,
    borderWidth: 1.5,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarButtons: {
    flex: 1,
    gap: Theme.spacing.sm,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
    backgroundColor: Colors.goldFaint,
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.pill,
    paddingVertical: Theme.spacing.sm,
    paddingHorizontal: Theme.spacing.md,
  },
  uploadBtnText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.gold,
    fontWeight: '500',
  },
  removeBtn: {
    paddingVertical: Theme.spacing.xs,
    paddingHorizontal: Theme.spacing.md,
  },
  removeBtnText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },

  // Experience
  experienceGrid: { gap: Theme.spacing.sm },
  experienceCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  experienceCardSelected: {
    backgroundColor: 'rgba(245,197,24,0.1)',
    borderColor: 'rgba(245,197,24,0.4)',
  },
  experienceEmoji: { fontSize: 28, flexShrink: 0 },
  experienceText: { flex: 1, gap: 2 },
  experienceLabel: {
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  experienceLabelSelected: { color: Colors.textPrimary },
  experienceDescription: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },

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
  skipHint: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
    textAlign: 'center',
  },
});