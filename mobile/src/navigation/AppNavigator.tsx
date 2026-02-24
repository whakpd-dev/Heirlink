import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { NavigationContainer, NavigationContainerRef, CommonActions, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, StackNavigationOptions } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { socketService } from '../services/socketService';
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
import { CreateAlbumScreen } from '../screens/Album/CreateAlbumScreen';
import { AlbumDetailScreen } from '../screens/Album/AlbumDetailScreen';
import { AlbumMembersScreen } from '../screens/Album/AlbumMembersScreen';
import { AlbumSettingsScreen } from '../screens/Album/AlbumSettingsScreen';
import { MediaViewerScreen } from '../screens/Album/MediaViewerScreen';
import { SavedPostsScreen } from '../screens/Profile/SavedPostsScreen';
import { AuthNavigator } from './AuthNavigator';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

const linking = {
  prefixes: ['heirlink://', 'https://api.whakcomp.ru'],
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

const Tab = createBottomTabNavigator();
const RootStack = createStackNavigator();
const FeedStackNav = createStackNavigator();
const ExploreStackNav = createStackNavigator();
const ChatStackNav = createStackNavigator();
const ProfileStackNav = createStackNavigator();

const stackScreenOptions: StackNavigationOptions = {
  headerShown: false,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
  cardStyleInterpolator: ({ current, layouts }) => ({
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width, 0],
          }),
        },
      ],
    },
  }),
};

const FeedStack = () => (
  <FeedStackNav.Navigator screenOptions={stackScreenOptions}>
    <FeedStackNav.Screen name="Feed" component={FeedScreen} />
    <FeedStackNav.Screen name="PostDetail" component={PostDetailScreen} />
    <FeedStackNav.Screen name="StoriesViewer" component={StoriesViewerScreen} />
    <FeedStackNav.Screen name="Activity" component={ActivityScreen} />
    <FeedStackNav.Screen name="Profile" component={ProfileScreen} />
    <FeedStackNav.Screen name="FollowList" component={FollowListScreen} />
    <FeedStackNav.Screen name="ChatThread" component={ChatThreadScreen} />
    <FeedStackNav.Screen name="AlbumDetail" component={AlbumDetailScreen} />
    <FeedStackNav.Screen name="AlbumMembers" component={AlbumMembersScreen} />
    <FeedStackNav.Screen name="AlbumSettings" component={AlbumSettingsScreen} />
    <FeedStackNav.Screen name="MediaViewer" component={MediaViewerScreen} />
    <FeedStackNav.Screen name="SavedPosts" component={SavedPostsScreen} />
  </FeedStackNav.Navigator>
);

const ExploreStack = () => (
  <ExploreStackNav.Navigator screenOptions={stackScreenOptions}>
    <ExploreStackNav.Screen name="Explore" component={ExploreScreen} />
    <ExploreStackNav.Screen name="Profile" component={ProfileScreen} />
    <ExploreStackNav.Screen name="PostDetail" component={PostDetailScreen} />
    <ExploreStackNav.Screen name="FollowList" component={FollowListScreen} />
    <ExploreStackNav.Screen name="ChatThread" component={ChatThreadScreen} />
    <ExploreStackNav.Screen name="AlbumDetail" component={AlbumDetailScreen} />
    <ExploreStackNav.Screen name="AlbumMembers" component={AlbumMembersScreen} />
    <ExploreStackNav.Screen name="AlbumSettings" component={AlbumSettingsScreen} />
    <ExploreStackNav.Screen name="MediaViewer" component={MediaViewerScreen} />
  </ExploreStackNav.Navigator>
);

const ChatStack = () => (
  <ChatStackNav.Navigator screenOptions={stackScreenOptions}>
    <ChatStackNav.Screen name="ChatList" component={ChatListScreen} />
    <ChatStackNav.Screen name="ChatThread" component={ChatThreadScreen} />
    <ChatStackNav.Screen name="Profile" component={ProfileScreen} />
  </ChatStackNav.Navigator>
);

const ProfileStack = () => (
  <ProfileStackNav.Navigator screenOptions={stackScreenOptions}>
    <ProfileStackNav.Screen name="MyProfile" component={ProfileScreen} />
    <ProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
    <ProfileStackNav.Screen name="PostDetail" component={PostDetailScreen} />
    <ProfileStackNav.Screen name="Settings" component={SettingsScreen} />
    <ProfileStackNav.Screen name="GrokChat" component={GrokChatScreen} />
    <ProfileStackNav.Screen name="About" component={AboutScreen} />
    <ProfileStackNav.Screen name="SmartAlbum" component={SmartAlbumScreen} />
    <ProfileStackNav.Screen name="SmartAlbumItem" component={SmartAlbumItemScreen} />
    <ProfileStackNav.Screen name="LocalMedia" component={LocalMediaScreen} />
    <ProfileStackNav.Screen name="FollowList" component={FollowListScreen} />
    <ProfileStackNav.Screen name="Profile" component={ProfileScreen} />
    <ProfileStackNav.Screen name="ChatThread" component={ChatThreadScreen} />
    <ProfileStackNav.Screen name="CreateAlbum" component={CreateAlbumScreen} />
    <ProfileStackNav.Screen name="AlbumDetail" component={AlbumDetailScreen} />
    <ProfileStackNav.Screen name="AlbumMembers" component={AlbumMembersScreen} />
    <ProfileStackNav.Screen name="AlbumSettings" component={AlbumSettingsScreen} />
    <ProfileStackNav.Screen name="MediaViewer" component={MediaViewerScreen} />
    <ProfileStackNav.Screen name="SavedPosts" component={SavedPostsScreen} />
  </ProfileStackNav.Navigator>
);

const MainTabs = () => {
  const { colors } = useTheme();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifs, setUnreadNotifs] = useState(0);

  useEffect(() => {
    const unsubMsg = socketService.on('newMessage', () => {
      setUnreadMessages((c) => c + 1);
    });
    const unsubNotif = socketService.on('newNotification', () => {
      setUnreadNotifs((c) => c + 1);
    });
    return () => { unsubMsg(); unsubNotif(); };
  }, []);

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
          tabBarBadge: unreadNotifs > 0 ? unreadNotifs : undefined,
          tabBarBadgeStyle: { backgroundColor: '#FF3B30', fontSize: 10 },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            setUnreadNotifs(0);
            const state = navigation.getState();
            const feedTab = state?.routes?.find((r: any) => r.name === 'FeedTab');
            const nestedState = (feedTab as any)?.state;
            if (nestedState && nestedState.index > 0) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'FeedTab', state: { routes: [{ name: 'Feed' }] } }],
                }),
              );
            }
          },
        })}
      />
      <Tab.Screen
        name="ExploreTab"
        component={ExploreStack}
        options={{
          tabBarLabel: 'Поиск',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const tab = state?.routes?.find((r: any) => r.name === 'ExploreTab');
            const nestedState = (tab as any)?.state;
            if (nestedState && nestedState.index > 0) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    ...state.routes.filter((r: any) => r.name !== 'ExploreTab').map((r: any) => ({ ...r })),
                    { name: 'ExploreTab', state: { routes: [{ name: 'Explore' }] } },
                  ].sort((a: any, b: any) => {
                    const order = ['FeedTab', 'ExploreTab', 'Create', 'ChatTab', 'ProfileTab'];
                    return order.indexOf(a.name) - order.indexOf(b.name);
                  }),
                }),
              );
            }
          },
        })}
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
          tabBarBadge: unreadMessages > 0 ? unreadMessages : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary || '#FF3B30', fontSize: 10 },
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'chatbubbles' : 'chatbubbles-outline'} size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            setUnreadMessages(0);
            const state = navigation.getState();
            const tab = state?.routes?.find((r: any) => r.name === 'ChatTab');
            const nestedState = (tab as any)?.state;
            if (nestedState && nestedState.index > 0) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    ...state.routes.filter((r: any) => r.name !== 'ChatTab').map((r: any) => ({ ...r })),
                    { name: 'ChatTab', state: { routes: [{ name: 'ChatList' }] } },
                  ].sort((a: any, b: any) => {
                    const order = ['FeedTab', 'ExploreTab', 'Create', 'ChatTab', 'ProfileTab'];
                    return order.indexOf(a.name) - order.indexOf(b.name);
                  }),
                }),
              );
            }
          },
        })}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ focused, color, size }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            const state = navigation.getState();
            const tab = state?.routes?.find((r: any) => r.name === 'ProfileTab');
            const nestedState = (tab as any)?.state;
            if (nestedState && nestedState.index > 0) {
              e.preventDefault();
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [
                    ...state.routes.filter((r: any) => r.name !== 'ProfileTab').map((r: any) => ({ ...r })),
                    { name: 'ProfileTab', state: { routes: [{ name: 'MyProfile' }] } },
                  ].sort((a: any, b: any) => {
                    const order = ['FeedTab', 'ExploreTab', 'Create', 'ChatTab', 'ProfileTab'];
                    return order.indexOf(a.name) - order.indexOf(b.name);
                  }),
                }),
              );
            }
          },
        })}
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

  const { colors, isDark } = useTheme();

  const navigationTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.border as string,
        primary: colors.primary,
        notification: colors.like,
      },
    }),
    [isDark, colors],
  );

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking} theme={navigationTheme}>
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
