// ============================================================
// PINCHANTED — Reset Password Screen (deep link)
// app/reset-password.tsx
// ============================================================

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { supabase } from '../src/lib/supabase';
import { Colors } from '../src/constants/colors';
import { Theme } from '../src/constants/theme';

export default function ResetPasswordScreen() {
  const insets = useSafeAreaInsets();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isInvalid, setIsInvalid] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  const passwordsMatch = password === confirm && confirm.length > 0;
  const meetsLength = password.length >= 8;
  const meetsUpper = /[A-Z]/.test(password);
  const meetsNumber = /[0-9]/.test(password);
  const isValid = meetsLength && meetsUpper && meetsNumber && passwordsMatch;

  useEffect(() => {
    const handleUrl = async (url: string) => {
        console.log('Reset URL received:', url);
      try {
        const hashIndex = url.indexOf('#');
        if (hashIndex === -1) {
          setIsInvalid(true);
          return;
        }

        const hash = url.substring(hashIndex + 1);
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        const type = params.get('type');

        if (!accessToken || type !== 'recovery') {
          setIsInvalid(true);
          return;
        }

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });

        if (error) {
          console.error('Session error:', error);
          setIsInvalid(true);
          return;
        }

        setSessionReady(true);
      } catch (err) {
        console.error('URL parse error:', err);
        setIsInvalid(true);
      }
    };

    // Handle both cases: app was closed (getInitialURL) 
    // and app was already open (addEventListener)
    Linking.getInitialURL().then(url => {
      if (url) {
        handleUrl(url);
      }
    });

    // Also listen for URL events if app was already running
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => subscription.remove();
  }, []);

  const handleReset = async () => {
    if (!isValid || !sessionReady) return;
    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    setIsLoading(false);

    if (error) {
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        setIsInvalid(true);
      } else {
        Alert.alert('Error', error.message || 'Could not update password. Please try again.');
      }
      return;
    }

    // Sign out after reset so user logs in fresh with new password
    await supabase.auth.signOut();
    setIsSuccess(true);
  };

  const Requirement = ({ met, label }: { met: boolean; label: string }) => (
    <View style={styles.reqRow}>
      <View style={[styles.reqDot, met && styles.reqDotMet]} />
      <Text style={[styles.reqText, met && styles.reqTextMet]}>{label}</Text>
    </View>
  );

  if (isInvalid) {
    return (
      <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
        <View style={[styles.centeredContent, { paddingTop: insets.top }]}>
          <Text style={styles.bigEmoji}>⚠️</Text>
          <Text style={styles.title}>Link expired</Text>
          <Text style={styles.subtitle}>
            This reset link has expired or already been used. Please request a new one.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace('/(auth)/forgot-password')}
          >
            <Text style={styles.btnText}>Request new link</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  if (isSuccess) {
    return (
      <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
        <View style={[styles.centeredContent, { paddingTop: insets.top }]}>
          <Text style={styles.bigEmoji}>✅</Text>
          <Text style={styles.title}>Password updated!</Text>
          <Text style={styles.subtitle}>
            Your password has been successfully reset. Sign in with your new password.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace('/(auth)/login')}
          >
            <Text style={styles.btnText}>Sign in</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#0f1d6e', '#0b1554', '#08103d']} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 60 + insets.top }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <View style={styles.logoInner}>
                <View style={styles.logoDot} />
              </View>
            </View>
            <Text style={styles.appName}>Pinchanted</Text>
            <Text style={styles.tagline}>YOUR MAGICAL PIN COLLECTION</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <AntDesign name="lock" size={24} color={Colors.gold} />
              <Text style={styles.cardTitle}>Set new password</Text>
              <Text style={styles.cardSubtitle}>
                Choose a strong password for your account.
              </Text>
            </View>

            {!sessionReady && (
              <View style={styles.verifyingRow}>
                <ActivityIndicator size="small" color={Colors.gold} />
                <Text style={styles.verifyingText}>Verifying reset link...</Text>
              </View>
            )}

            {/* New password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>New password</Text>
              <View style={styles.inputWrapper}>
                <AntDesign name="lock" size={14} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="At least 8 characters"
                  placeholderTextColor={Colors.textPlaceholder}
                  secureTextEntry
                  editable={sessionReady}
                />
              </View>
            </View>

            {/* Requirements */}
            <View style={styles.requirements}>
              <Requirement met={meetsLength} label="At least 8 characters" />
              <Requirement met={meetsUpper} label="One uppercase letter" />
              <Requirement met={meetsNumber} label="One number" />
            </View>

            {/* Confirm password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={styles.inputWrapper}>
                <AntDesign name="lock" size={14} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.textPlaceholder}
                  secureTextEntry
                  editable={sessionReady}
                />
              </View>
              {confirm.length > 0 && !passwordsMatch && (
                <Text style={styles.mismatchText}>Passwords don't match</Text>
              )}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.btn, (!isValid || !sessionReady) && styles.btnDisabled]}
              onPress={handleReset}
              disabled={!isValid || !sessionReady || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.btnText}>Update password</Text>
              )}
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboardView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    padding: Theme.screenPadding,
    gap: Theme.spacing.xl,
  },
  centeredContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Theme.screenPadding,
    gap: Theme.spacing.lg,
  },
  bigEmoji: { fontSize: 56 },

  // Logo
  logoContainer: {
    alignItems: 'center',
    gap: Theme.spacing.sm,
    marginBottom: Theme.spacing.md,
  },
  logoCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#1a2a8f',
    borderWidth: 2, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  logoInner: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.gold,
    opacity: 0.9,
    alignItems: 'center', justifyContent: 'center',
  },
  logoDot: {
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.crimson,
  },
  appName: {
    fontSize: 24, fontWeight: '500',
    color: Colors.textPrimary, letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 10, color: Colors.textMuted, letterSpacing: 1.5,
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
  cardHeader: {
    alignItems: 'center',
    gap: Theme.spacing.xs,
    paddingBottom: Theme.spacing.xs,
  },
  cardTitle: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
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
    lineHeight: 22,
  },

  // Verifying
  verifyingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Theme.spacing.sm,
  },
  verifyingText: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },

  // Fields
  fieldContainer: { gap: Theme.spacing.xs },
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
  input: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
  },
  mismatchText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.error,
    marginTop: 2,
  },

  // Requirements
  requirements: { gap: 6 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reqDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  reqDotMet: { backgroundColor: Colors.success },
  reqText: { fontSize: Theme.fontSize.xs, color: Colors.textMuted },
  reqTextMet: { color: Colors.success },

  // Button
  btn: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  btnDisabled: { opacity: 0.45 },
  btnText: {
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },
});