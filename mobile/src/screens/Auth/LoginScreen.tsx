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
import { login, clearError } from '../../store/authSlice';
import { RootState, AppDispatch } from '../../store/store';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });

  const passwordRef = useRef<TextInput>(null);
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  React.useEffect(() => {
    if (error) {
      const text =
        error === 'Invalid credentials'
          ? 'Неверный email или пароль'
          : error;
      setTouched({ email: true, password: true });
      dispatch(clearError());
      setTimeout(() => setErrorMessage(text), 50);
    }
  }, [error, dispatch]);

  const [errorMessage, setErrorMessage] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const passwordValid = password.length >= 8;
  const formValid = emailValid && passwordValid;

  const handleLogin = async () => {
    setTouched({ email: true, password: true });
    setErrorMessage('');

    if (!email.trim() || !password) {
      setErrorMessage('Заполните все поля');
      return;
    }
    if (!emailValid) {
      setErrorMessage('Введите корректный email');
      return;
    }
    if (!passwordValid) {
      setErrorMessage('Пароль — минимум 8 символов');
      return;
    }

    try {
      await dispatch(login({ email: email.trim(), password })).unwrap();
    } catch {
      // обработано в useEffect
    }
  };

  const s = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.background },
        scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 40 },
        logoWrap: { alignItems: 'center', marginBottom: 40 },
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
        inputIcon: { marginRight: 10 },
        input: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 0 },
        eyeBtn: { padding: 6 },

        errorBox: {
          flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.08)',
          borderRadius: 10, padding: 12, marginBottom: 16,
        },
        errorText: { color: colors.like, fontSize: 13, marginLeft: 8, flex: 1, lineHeight: 18 },

        button: {
          height: 52, borderRadius: 12, justifyContent: 'center', alignItems: 'center',
          marginTop: 4,
        },
        buttonActive: { backgroundColor: colors.primary },
        buttonDisabled: { backgroundColor: colors.border },
        buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },

        forgotBtn: { alignSelf: 'flex-end', marginTop: 8, marginBottom: 16 },
        forgotText: { color: colors.primary, fontSize: 13, fontWeight: '500' },

        divider: {
          flexDirection: 'row', alignItems: 'center', marginVertical: 28,
        },
        dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
        dividerText: { color: colors.textTertiary, fontSize: 13, marginHorizontal: 16 },

        linkButton: { alignItems: 'center' },
        linkText: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
        linkBold: { color: colors.primary, fontWeight: '600' },
      }),
    [colors],
  );

  const [focusField, setFocusField] = useState<string | null>(null);

  const inputStyle = (field: string, valid: boolean) => [
    s.inputWrap,
    focusField === field ? s.inputFocused : s.inputDefault,
    touched[field as keyof typeof touched] && !valid && focusField !== field ? s.inputError : null,
  ];

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
            <Text style={s.subtitle}>Войдите в свой аккаунт</Text>
          </View>

          <View style={s.form}>
            {!!errorMessage && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle" size={18} color={colors.like} />
                <Text style={s.errorText}>{errorMessage}</Text>
              </View>
            )}

            <View style={inputStyle('email', emailValid)}>
              <Ionicons name="mail-outline" size={20} color={focusField === 'email' ? colors.primary : colors.textTertiary} style={s.inputIcon} />
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
                onSubmitEditing={() => passwordRef.current?.focus()}
                onFocus={() => setFocusField('email')}
                onBlur={() => { setFocusField(null); setTouched((p) => ({ ...p, email: true })); }}
              />
            </View>

            <View style={inputStyle('password', passwordValid)}>
              <Ionicons name="lock-closed-outline" size={20} color={focusField === 'password' ? colors.primary : colors.textTertiary} style={s.inputIcon} />
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
                onSubmitEditing={handleLogin}
                onFocus={() => setFocusField('password')}
                onBlur={() => { setFocusField(null); setTouched((p) => ({ ...p, password: true })); }}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.forgotBtn} onPress={() => navigation.navigate('ForgotPassword' as never)}>
              <Text style={s.forgotText}>Забыли пароль?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.button, formValid && !isLoading ? s.buttonActive : s.buttonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={s.buttonText}>Войти</Text>
              )}
            </TouchableOpacity>

            <View style={s.divider}>
              <View style={s.dividerLine} />
              <Text style={s.dividerText}>или</Text>
              <View style={s.dividerLine} />
            </View>

            <TouchableOpacity style={s.linkButton} onPress={() => navigation.navigate('Register' as never)}>
              <Text style={s.linkText}>
                Нет аккаунта? <Text style={s.linkBold}>Зарегистрироваться</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};
