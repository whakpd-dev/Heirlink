import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDispatch, useSelector } from 'react-redux';
import { register, clearError } from '../../store/authSlice';
import { RootState, AppDispatch } from '../../store/store';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

const getPasswordStrength = (pw: string): { level: number; label: string; color: string } => {
  if (pw.length === 0) return { level: 0, label: '', color: 'transparent' };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { level: 1, label: 'Слабый', color: '#ef4444' };
  if (score <= 2) return { level: 2, label: 'Средний', color: '#f59e0b' };
  if (score <= 3) return { level: 3, label: 'Хороший', color: '#22c55e' };
  return { level: 4, label: 'Отличный', color: '#16a34a' };
};

export const RegisterScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, username: false, password: false });
  const [focusField, setFocusField] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const usernameRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  React.useEffect(() => {
    if (error) {
      const text =
        error === 'User with this email or username already exists'
          ? 'Такой email или имя пользователя уже заняты.'
          : error;
      setErrorMessage(text);
      dispatch(clearError());
    }
  }, [error, dispatch]);

  const trimmedEmail = email.trim();
  const trimmedUsername = username.trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const usernameValid = /^[a-z0-9_]{3,30}$/.test(trimmedUsername);
  const passwordValid = password.length >= 8;
  const formValid = emailValid && usernameValid && passwordValid;
  const pwStrength = getPasswordStrength(password);

  const handleRegister = async () => {
    setTouched({ email: true, username: true, password: true });
    setErrorMessage('');

    if (!trimmedEmail || !trimmedUsername || !password) {
      setErrorMessage('Заполните все поля');
      return;
    }
    if (!emailValid) { setErrorMessage('Введите корректный email'); return; }
    if (!usernameValid) {
      setErrorMessage('Имя: 3–30 символов, латиница, цифры и _');
      return;
    }
    if (!passwordValid) { setErrorMessage('Пароль — минимум 8 символов'); return; }

    try {
      await dispatch(register({ email: trimmedEmail, username: trimmedUsername, password })).unwrap();
    } catch {
      // обработано в useEffect
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
        logoWrap: { alignItems: 'center', marginBottom: 36 },
        logoIcon: {
          width: 72, height: 72, borderRadius: 20, backgroundColor: colors.primary,
          justifyContent: 'center', alignItems: 'center', marginBottom: 16,
        },
        logoText: { fontSize: 28, fontWeight: '700', color: colors.text, letterSpacing: -0.5 },
        subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 4 },

        form: { width: '100%' },
        inputWrap: {
          flexDirection: 'row', alignItems: 'center',
          borderWidth: 1.5, borderRadius: 12, marginBottom: 14,
          backgroundColor: colors.surface, paddingHorizontal: 14, height: 52,
        },
        inputDefault: { borderColor: colors.border },
        inputFocused: { borderColor: colors.primary },
        inputError: { borderColor: colors.like },
        inputSuccess: { borderColor: '#22c55e' },
        inputIcon: { marginRight: 10 },
        input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
        eyeBtn: { padding: 6 },
        checkIcon: { marginLeft: 4 },

        hint: { fontSize: 12, color: colors.textTertiary, marginTop: -8, marginBottom: 12, marginLeft: 4 },

        strengthRow: { flexDirection: 'row', alignItems: 'center', marginTop: -6, marginBottom: 12, marginLeft: 4 },
        strengthBar: { height: 3, borderRadius: 2, marginRight: 3 },
        strengthLabel: { fontSize: 11, fontWeight: '500', marginLeft: 6 },

        errorBox: {
          flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)',
          borderRadius: 10, padding: 12, marginBottom: 16,
        },
        errorText: { color: colors.like, fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 },

        button: {
          height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
          marginTop: 6,
        },
        buttonActive: { backgroundColor: colors.primary },
        buttonDisabled: { backgroundColor: colors.border },
        buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

        divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 28 },
        dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
        dividerText: { color: colors.textTertiary, fontSize: 13, marginHorizontal: 16 },

        linkButton: { alignItems: 'center' },
        linkText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
        linkBold: { color: colors.primary, fontWeight: '600' },

        terms: { fontSize: 12, color: colors.textTertiary, textAlign: 'center', marginTop: 20, lineHeight: 17 },
      }),
    [colors],
  );

  const inputStyle = (field: string, valid: boolean) => [
    s.inputWrap,
    focusField === field
      ? s.inputFocused
      : touched[field as keyof typeof touched]
        ? valid ? s.inputSuccess : s.inputError
        : s.inputDefault,
  ];

  const iconColor = (field: string, valid: boolean) =>
    focusField === field
      ? colors.primary
      : touched[field as keyof typeof touched] && valid
        ? '#22c55e'
        : colors.textTertiary;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={s.container}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.logoWrap}>
            <View style={s.logoIcon}>
              <Ionicons name="link" size={36} color="#fff" />
            </View>
            <Text style={s.logoText}>HeirLink</Text>
            <Text style={s.subtitle}>Создайте аккаунт</Text>
          </View>

          <View style={s.form}>
            {!!errorMessage && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.like} />
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            )}

            {/* Email */}
            <View style={inputStyle('email', emailValid)}>
              <Ionicons name="mail-outline" size={20} color={iconColor('email', emailValid)} style={s.inputIcon} />
              <TextInput
                style={s.input}
                placeholder="Email"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={(t) => { setEmail(t); setErrorMessage(''); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoCorrect={false}
                returnKeyType="next"
                onSubmitEditing={() => usernameRef.current?.focus()}
                onFocus={() => setFocusField('email')}
                onBlur={() => { setFocusField(null); setTouched((p) => ({ ...p, email: true })); }}
              />
              {touched.email && emailValid && (
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" style={s.checkIcon} />
              )}
            </View>

            {/* Username */}
            <View style={inputStyle('username', usernameValid)}>
              <Ionicons name="person-outline" size={20} color={iconColor('username', usernameValid)} style={s.inputIcon} />
              <TextInput
                ref={usernameRef}
                style={s.input}
                placeholder="Имя пользователя"
                placeholderTextColor={colors.textTertiary}
                value={username}
                onChangeText={(t) => { setUsername(t.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30)); setErrorMessage(''); }}
                autoCapitalize="none"
                autoComplete="username"
                autoCorrect={false}
                maxLength={30}
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setFocusField('username')}
                onBlur={() => { setFocusField(null); setTouched((p) => ({ ...p, username: true })); }}
              />
              {touched.username && usernameValid && (
                <Ionicons name="checkmark-circle" size={18} color="#22c55e" style={s.checkIcon} />
              )}
            </View>
            {focusField === 'username' && (
              <Text style={s.hint}>Латиница, цифры и _ (от 3 до 30 символов)</Text>
            )}

            {/* Password */}
            <View style={inputStyle('password', passwordValid)}>
              <Ionicons name="lock-closed-outline" size={20} color={iconColor('password', passwordValid)} style={s.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={s.input}
                placeholder="Пароль"
                placeholderTextColor={colors.textTertiary}
                value={password}
                onChangeText={(t) => { setPassword(t); setErrorMessage(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="go"
                onSubmitEditing={handleRegister}
                onFocus={() => setFocusField('password')}
                onBlur={() => { setFocusField(null); setTouched((p) => ({ ...p, password: true })); }}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            {password.length > 0 && (
              <View style={s.strengthRow}>
                {[1, 2, 3, 4].map((i) => (
                  <View
                    key={i}
                    style={[
                      s.strengthBar,
                      { width: 40, backgroundColor: i <= pwStrength.level ? pwStrength.color : colors.border },
                    ]}
                  />
                ))}
                <Text style={[s.strengthLabel, { color: pwStrength.color }]}>{pwStrength.label}</Text>
              </View>
            )}

            <TouchableOpacity
              style={[s.button, formValid && !isLoading ? s.buttonActive : s.buttonDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.buttonText}>Создать аккаунт</Text>
              )}
            </TouchableOpacity>

            <Text style={s.terms}>
              Нажимая «Создать аккаунт», вы соглашаетесь{'\n'}с условиями использования
            </Text>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>или</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity style={s.linkButton} onPress={() => navigation.navigate('Login' as never)}>
              <Text style={s.linkText}>
                Уже есть аккаунт? <Text style={s.linkBold}>Войти</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};
