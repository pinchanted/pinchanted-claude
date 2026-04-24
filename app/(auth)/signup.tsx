// ============================================================
// PINCHANTED — Signup Screen
// app/(auth)/signup.tsx
// ============================================================

import { useState } from 'react';
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
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AntDesign } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { signUpWithEmail, checkUsernameAvailable, supabase } from '../../src/lib/supabase';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';

export default function SignupScreen() {
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const showPasswordMismatch = confirmTouched && !passwordsMatch;
  const showPasswordMatch = confirmTouched && passwordsMatch && confirmPassword.length > 0;

  const handleUsernameChange = async (value: string) => {
    const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    setUsername(cleaned);
    if (cleaned.length >= 3) {
      setCheckingUsername(true);
      const { available } = await checkUsernameAvailable(cleaned);
      setUsernameAvailable(available);
      setCheckingUsername(false);
    } else {
      setUsernameAvailable(null);
    }
  };


  const handleSignup = async () => {
    if (!displayName || !username || !email || !password || !confirmPassword) {
      Alert.alert('Missing details', 'Please fill in all fields.');
      return;
    }
    if (username.length < 3) {
      Alert.alert('Username too short', 'Username must be at least 3 characters.');
      return;
    }
    if (!usernameAvailable) {
      Alert.alert('Username taken', 'Please choose a different username.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Password too short', 'Password must be at least 8 characters.');
      return;
    }
    if (!passwordsMatch) {
      Alert.alert("Passwords don't match", 'Please make sure your passwords match.');
      return;
    }

    setIsLoading(true);
    const { data, error } = await signUpWithEmail(email, password, username, displayName);

    if (error) {
      setIsLoading(false);
      Alert.alert('Sign up failed', error.message);
      return;
    }

    if (data?.user) {

      setIsLoading(false);
      router.replace('/(onboarding)/step-1');
    } else {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0f1d6e', '#0b1554', '#08103d']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: 60 + insets.top }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <AntDesign name="left" size={16} color={Colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>Create account</Text>
              <Text style={styles.subtitle}>Join the Pinchanted community</Text>
            </View>
          </View>

          {/* Card */}
          <View style={styles.card}>

            {/* Display name */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Your name</Text>
              <View style={styles.inputWrapper}>
                <AntDesign name="user" size={14} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={styles.input}
                  value={displayName}
                  onChangeText={setDisplayName}
                  placeholder="e.g. Mickey Collector"
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
                {checkingUsername && <ActivityIndicator size="small" color={Colors.gold} />}
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
              {usernameAvailable === true && (
                <Text style={styles.fieldSuccess}>Username available!</Text>
              )}
              <Text style={styles.fieldHint}>Letters, numbers and underscores only</Text>
            </View>

            {/* Email */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrapper}>
                <AntDesign name="mail" size={14} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={Colors.textPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <AntDesign name="lock" size={14} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  onBlur={() => setPasswordTouched(true)}
                  placeholder="At least 8 characters"
                  placeholderTextColor={Colors.textPlaceholder}
                  secureTextEntry
                  autoComplete="off"
                />
              </View>
              {passwordTouched && password.length > 0 && password.length < 8 && (
                <Text style={styles.fieldError}>Password must be at least 8 characters</Text>
              )}
            </View>

            {/* Confirm password */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Confirm password</Text>
              <View style={[
                styles.inputWrapper,
                showPasswordMatch && styles.inputValid,
                showPasswordMismatch && styles.inputInvalid,
              ]}>
                <AntDesign name="lock" size={14} color="rgba(255,255,255,0.4)" />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onBlur={() => setConfirmTouched(true)}
                  placeholder="Re-enter your password"
                  placeholderTextColor={Colors.textPlaceholder}
                  secureTextEntry
                  autoComplete="off"
                />
                {showPasswordMatch && (
                  <AntDesign name="check-circle" size={14} color={Colors.success} />
                )}
                {showPasswordMismatch && (
                  <AntDesign name="close-circle" size={14} color={Colors.error} />
                )}
              </View>
              {showPasswordMismatch && (
                <Text style={styles.fieldError}>Passwords don't match</Text>
              )}
              {showPasswordMatch && (
                <Text style={styles.fieldSuccess}>Passwords match!</Text>
              )}
            </View>

            {/* Create account button */}
            <TouchableOpacity
              style={styles.createButton}
              onPress={handleSignup}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonText}>Create account</Text>
              )}
            </TouchableOpacity>

            {/* Terms */}
            <Text style={styles.terms}>
              By creating an account you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>

          </View>

          {/* Footer */}
          <TouchableOpacity onPress={() => router.back()} style={styles.footerContainer}>
            <Text style={styles.footer}>
              Already have an account?{' '}
              <Text style={styles.footerLink}>Sign in</Text>
            </Text>
          </TouchableOpacity>

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

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.md,
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { gap: 2 },
  title: {
    fontSize: Theme.fontSize.xl,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Theme.fontSize.sm,
    color: Colors.textMuted,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
  },

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
  inputValid: { borderColor: Colors.successBorder },
  inputInvalid: { borderColor: Colors.errorBorder },
  atSign: {
    fontSize: Theme.fontSize.md,
    color: Colors.gold,
    fontWeight: '500',
  },
  countryCode: {
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
  fieldError: { fontSize: Theme.fontSize.xs, color: Colors.error },
  fieldSuccess: { fontSize: Theme.fontSize.xs, color: Colors.success },
  fieldHint: { fontSize: Theme.fontSize.xs, color: Colors.textFaint },

  createButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
    marginTop: Theme.spacing.xs,
  },
  createButtonText: {
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },

  terms: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textFaint,
    textAlign: 'center',
    lineHeight: 16,
  },
  termsLink: { color: Colors.gold },

  footerContainer: { alignItems: 'center' },
  footer: { color: Colors.textMuted, fontSize: Theme.fontSize.sm },
  footerLink: { color: Colors.gold },
});