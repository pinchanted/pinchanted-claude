// ============================================================
// PINCHANTED — Login Screen
// app/(auth)/login.tsx
// ============================================================

import { useState, useEffect } from 'react';
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
import { signInWithEmail, getProfile, supabase } from '../../src/lib/supabase';
import { setCurrentSession } from '../../src/lib/auth';
import { Colors } from '../../src/constants/colors';
import { Theme } from '../../src/constants/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentSession(session);
        router.replace('/(tabs)');
      } else {
        setIsLoading(false);
      }
    }).catch(() => {
      setIsLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing details', 'Please enter your email and password.');
      return;
    }
    setIsLoading(true);
    const { data, error } = await signInWithEmail(email, password);

    if (error) {
      setIsLoading(false);
      Alert.alert('Sign in failed', error.message);
      return;
    }

    if (data?.user) {
      try {
        // Store session in memory
        if (data?.session) {
          setCurrentSession(data.session);
        }

        await new Promise(resolve => setTimeout(resolve, 500));
        const { data: profile } = await getProfile(data.user.id);
        const onboarded = !!profile?.collecting_experience;
        setIsLoading(false);

        if (onboarded) {
          router.replace('/(tabs)');
        } else {
          const hasStartedOnboarding =
            (profile?.collecting_style?.length ?? 0) > 0 ||
            profile?.avatar_style !== 'default';

          if (hasStartedOnboarding) {
            Alert.alert(
              'Welcome back! 👋',
              'You haven\'t finished setting up your profile yet. Would you like to complete it now?',
              [
                {
                  text: 'Maybe later',
                  style: 'cancel',
                  onPress: () => router.replace('/(tabs)'),
                },
                {
                  text: 'Finish setup',
                  onPress: () => router.replace('/(onboarding)/step-1'),
                },
              ]
            );
          } else {
            router.replace('/(onboarding)/step-1');
          }
        }
      } catch (err) {
        setIsLoading(false);
        router.replace('/(tabs)');
      }
    } else {
      setIsLoading(false);
    }
  };

  // Show spinner while checking session
  if (isLoading) {
    return (
      <View style={{
        flex: 1,
        backgroundColor: Colors.backgroundDark,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ActivityIndicator size="large" color={Colors.gold} />
      </View>
    );
  }

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
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Stars decoration */}
          <View style={styles.star1} />
          <View style={styles.star2} />
          <View style={styles.star3} />

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

            {/* Email field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Email address</Text>
              <View style={styles.inputWrapper}>
                <AntDesign
                  name="mail"
                  size={14}
                  color="rgba(255,255,255,0.4)"
                />
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

            {/* Password field */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <AntDesign
                  name="lock"
                  size={14}
                  color="rgba(255,255,255,0.4)"
                />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Your password"
                  placeholderTextColor={Colors.textPlaceholder}
                  secureTextEntry
                  autoComplete="off"
                />
              </View>
            </View>

            {/* Forgot password */}
            <TouchableOpacity
              onPress={() => router.push('/(auth)/forgot-password')}
              style={styles.forgotContainer}
            >
              <Text style={styles.forgotPassword}>Forgot password?</Text>
            </TouchableOpacity>

            {/* Sign in button */}
            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.signInButtonText}>Sign in</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              <TouchableOpacity style={styles.socialButton}>
                <AntDesign
                  name="apple"
                  size={14}
                  color="rgba(255,255,255,0.72)"
                />
                <Text style={styles.socialButtonText}>Apple</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.socialButton}>
                <AntDesign
                  name="google"
                  size={14}
                  color="rgba(255,255,255,0.72)"
                />
                <Text style={styles.socialButtonText}>Google</Text>
              </TouchableOpacity>
            </View>

          </View>

          {/* Footer */}
          <TouchableOpacity
            onPress={() => router.push('/(auth)/signup')}
            style={styles.footerContainer}
          >
            <Text style={styles.footer}>
              Don't have an account?{' '}
              <Text style={styles.footerLink}>Create one</Text>
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Theme.screenPadding,
    justifyContent: 'center',
    minHeight: '100%',
  },
  star1: {
    position: 'absolute',
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#fff',
    opacity: 0.6,
    top: '10%',
    left: '12%',
  },
  star2: {
    position: 'absolute',
    width: 1.5,
    height: 1.5,
    borderRadius: 1,
    backgroundColor: '#fff',
    opacity: 0.5,
    top: '18%',
    left: '82%',
  },
  star3: {
    position: 'absolute',
    width: 1,
    height: 1,
    borderRadius: 1,
    backgroundColor: '#fff',
    opacity: 0.6,
    top: '28%',
    left: '90%',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Theme.spacing.xxl,
    gap: Theme.spacing.sm,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a2a8f',
    borderWidth: 2,
    borderColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.gold,
    opacity: 0.9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.crimson,
  },
  appName: {
    fontSize: 26,
    fontWeight: '500',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 10,
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: Colors.goldBorder,
    borderRadius: Theme.radius.xl,
    padding: Theme.spacing.lg,
    gap: Theme.spacing.md,
    marginBottom: Theme.spacing.xl,
  },
  fieldContainer: {
    gap: Theme.spacing.xs,
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
  input: {
    flex: 1,
    paddingVertical: Theme.spacing.md,
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
  },
  forgotContainer: {
    alignItems: 'flex-end',
    marginTop: -4,
  },
  forgotPassword: {
    color: Colors.gold,
    fontSize: Theme.fontSize.sm,
  },
  signInButton: {
    backgroundColor: Colors.crimson,
    borderRadius: Theme.radius.pill,
    padding: Theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.goldBorder,
  },
  signInButtonText: {
    color: Colors.textPrimary,
    fontSize: Theme.fontSize.md,
    fontWeight: '500',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Theme.spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(245,197,24,0.18)',
  },
  dividerText: {
    fontSize: Theme.fontSize.xs,
    color: Colors.textMuted,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Theme.spacing.sm,
  },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(245,197,24,0.18)',
    borderRadius: Theme.radius.md,
    padding: Theme.spacing.sm,
    gap: Theme.spacing.xs,
  },
  socialButtonText: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: Theme.fontSize.sm,
    fontWeight: '500',
  },
  footerContainer: {
    alignItems: 'center',
  },
  footer: {
    color: Colors.textMuted,
    fontSize: Theme.fontSize.sm,
  },
  footerLink: {
    color: Colors.gold,
  },
});