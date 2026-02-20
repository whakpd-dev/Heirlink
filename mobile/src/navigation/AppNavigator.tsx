import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RootState, AppDispatch } from '../store/store';
import { checkAuth, logout } from '../store/authSlice';
import { apiService } from '../services/api';
import { FeedScreen } from '../screens/Feed/FeedScreen';
import { PostDetailScreen } from '../screens/PostDetail/PostDetailScreen';
import { ExploreScreen } from '../screens/Explore/ExploreScreen';
import { CreateScreen } from '../screens/Create/CreateScreen';
import { ActivityScreen } from '../screens/Activity/ActivityScreen';
import { ChatListScreen } from '../screens/Chat/ChatListScreen';
import { ChatThreadScreen } from '../screens/Chat/ChatThreadScreen';
import { ProfileScreen } from '../screens/Profile/ProfileScreen';
import { EditProfileScreen } from '../screens/Profile/EditProfileScreen';
import { SettingsScreen } from '../screens/Settings/SettingsScreen';
import { AboutScreen } from '../screens/Settings/AboutScreen';
import { SmartAlbumScreen } from '../screens/SmartAlbum/SmartAlbumScreen';
import { SmartAlbumItemScreen } from '../screens/SmartAlbum/SmartAlbumItemScreen';
import { LocalMediaScreen } from '../screens/LocalMedia/LocalMediaScreen';
import { StoriesViewerScreen } from '../screens/StoriesViewer/StoriesViewerScreen';
import { GrokChatScreen } from '../screens/Ai/GrokChatScreen';
import { FollowListScreen } from '../screens/Follow/FollowListScreen';
import { AuthNavigator } from './AuthNavigator';
import * as Linking from 'expo-linking';

const linking = {
  prefixes: [Linking.createURL('/'), 'heirlink://', 'https://api.whakcomp.ru'],
  config: {
    screens: {
      Main: {
        screens: {
          FeedTab: {
            screens: {
              PostDetail: 'post/:postId',
              Profile: 'profile/:userId',
            },
          },
        },
      },
    },
  },
};
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();
const FeedStackNav = createStackNavigator();
const ExploreStackNav = createStackNavigator();
const ChatStackNav = createStackNavigator();
const ProfileStackNav = createStackNavigator();

const FeedStack = () => (
  <FeedStackNav.Navigator screenOptions={{ headerShown: false }}>
    <FeedStackNav.Screen name="Feed" component={FeedScreen} />
    <FeedStackNav.Screen name="PostDetail" component={PostDetailScreen} />
    <FeedStackNav.Screen name="StoriesViewer" component={StoriesViewerScreen} />
    <FeedStackNav.Screen name="Activity" component={ActivityScreen} />
    <FeedStackNav.Screen name="Profile" component={ProfileScreen} />
    <FeedStackNav.Screen name="FollowList" component={FollowListScreen} />
  </FeedStackNav.Navigator>
);

const ExploreStack = () => (
  <ExploreStackNav.Navigator screenOptions={{ headerShown: false }}>
    <ExploreStackNav.Screen name="Explore" component={ExploreScreen} />
    <ExploreStackNav.Screen name="Profile" component={ProfileScreen} />
    <ExploreStackNav.Screen name="PostDetail" component={PostDetailScreen} />
    <ExploreStackNav.Screen name="FollowList" component={FollowListScreen} />
  </ExploreStackNav.Navigator>
);

const ChatStack = () => (
  <ChatStackNav.Navigator screenOptions={{ headerShown: false }}>
    <ChatStackNav.Screen name="ChatList" component={ChatListScreen} />
    <ChatStackNav.Screen name="ChatThread" component={ChatThreadScreen} />
  </ChatStackNav.Navigator>
);

const ProfileStack = () => (
  <ProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
    <ProfileStackNav.Screen name="Profile" component={ProfileScreen} />
    <ProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
    <ProfileStackNav.Screen name="PostDetail" component={PostDetailScreen} />
    <ProfileStackNav.Screen name="Settings" component={SettingsScreen} />
    <ProfileStackNav.Screen name="GrokChat" component={GrokChatScreen} />
    <ProfileStackNav.Screen name="About" component={AboutScreen} />
    <ProfileStackNav.Screen name="SmartAlbum" component={SmartAlbumScreen} />
    <ProfileStackNav.Screen name="SmartAlbumItem" component={SmartAlbumItemScreen} />
    <ProfileStackNav.Screen name="LocalMedia" component={LocalMediaScreen} />
    <ProfileStackNav.Screen name="FollowList" component={FollowListScreen} />
  </ProfileStackNav.Navigator>
);

const MainTabs = () => {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingTop: spacing.sm,
          height: Platform.OS === 'ios' ? 88 : 64,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarShowLabel: true,
      }}
    >
      <Tab.Screen
        name="FeedTab"
        component={FeedStack}
        options={{
          tabBarLabel: 'Лента',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'home' : 'home-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStack}
        options={{
          tabBarLabel: 'Поиск',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'search' : 'search-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Create"
        component={CreateScreen}
        options={{
          tabBarLabel: 'Создать',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="add-circle" size={size + 4} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatStack}
        options={{
          tabBarLabel: 'Чаты',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons
              name={focused ? 'person' : 'person-outline'}
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export const AppNavigator: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    dispatch(checkAuth());
  }, [dispatch]);

  useEffect(() => {
    apiService.setOnUnauthorized(() => {
      dispatch(logout());
    });
  }, [dispatch]);

  const { colors } = useTheme();
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <RootStack.Screen name="Main" component={MainTabs} />
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
