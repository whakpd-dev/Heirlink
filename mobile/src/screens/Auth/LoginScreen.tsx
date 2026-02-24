import React, { useState, useMemo } from 'react';
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
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { login, clearError } from '../../store/authSlice';
import { RootState, AppDispatch } from '../../store/store';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../context/ThemeContext';

export const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { isLoading, error } = useSelector((state: RootState) => state.auth);

  React.useEffect(() => {
    if (error) {
      Alert.alert('Ошибка', error);
      dispatch(clearError());
    }
  }, [error]);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Ошибка', 'Заполните все поля');
      return;
    }

    try {
      await dispatch(login({ email, password })).unwrap();
    } catch (err) {
      // handled in slice
    }
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background,
        },
        content: {
          flex: 1,
          justifyContent: 'center',
          paddingHorizontal: 24,
        },
        logo: {
          fontSize: 48,
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: 8,
          color: colors.text,
        },
        subtitle: {
          fontSize: 16,
          color: colors.textSecondary,
          textAlign: 'center',
          marginBottom: 48,
        },
        form: {
          width: '100%',
        },
        input: {
          height: 50,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          paddingHorizontal: 16,
          fontSize: 16,
          marginBottom: 16,
          backgroundColor: colors.surface,
          color: colors.text,
        },
        button: {
          height: 50,
          backgroundColor: colors.primary,
          borderRadius: 8,
          justifyContent: 'center',
          alignItems: 'center',
          marginTop: 8,
        },
        buttonDisabled: {
          opacity: 0.6,
        },
        buttonText: {
          color: '#fff',
          fontSize: 16,
          fontWeight: '600',
        },
        linkButton: {
          marginTop: 24,
          alignItems: 'center',
        },
        linkText: {
          color: colors.textSecondary,
          fontSize: 14,
        },
        linkTextBold: {
          color: colors.primary,
          fontWeight: '600',
        },
      }),
    [colors],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.logo}>HeirLink</Text>
        <Text style={styles.subtitle}>Войдите в свой аккаунт</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={colors.textTertiary}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <TextInput
            style={styles.input}
            placeholder="Пароль"
            placeholderTextColor={colors.textTertiary}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Войти</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register' as never)}
          >
            <Text style={styles.linkText}>
              Нет аккаунта? <Text style={styles.linkTextBold}>Зарегистрироваться</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};
