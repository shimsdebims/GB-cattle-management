import React from 'react';
import { NavigationContainer, NavigatorScreenParams } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

import { colors } from '../constants/theme';

// Import screens
import DashboardScreen from '../screens/DashboardScreen';
import CattleListScreen from '../screens/CattleListScreen';
import CattleDetailScreen from '../screens/CattleDetailScreen';
import AddCattleScreen from '../screens/AddCattleScreen';
import MilkProductionScreen from '../screens/MilkProductionScreen';
import FeedingScreen from '../screens/FeedingScreen';
import FinancialScreen from '../screens/FinancialScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import MonthlyReportScreen from '../screens/MonthlyReportScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type MainTabParamList = {
  Dashboard: undefined;
  Cattle: undefined;
  Milk: undefined;
  Feeding: undefined;
  Financial: undefined;
  Monthly: undefined;
  Analytics: undefined;
};

/**
 * `MainTabs` is typed as nested navigator params so screens can jump straight
 * to a tab, e.g. navigate('MainTabs', { screen: 'Feeding' }).
 */
export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  CattleDetail: { cattleId: string };
  AddCattle: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<RootStackParamList>();

const MainTabs = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof MaterialIcons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = 'dashboard';
          } else if (route.name === 'Cattle') {
            iconName = 'pets';
          } else if (route.name === 'Milk') {
            iconName = 'local-drink';
          } else if (route.name === 'Feeding') {
            iconName = 'restaurant';
          } else if (route.name === 'Financial') {
            iconName = 'attach-money';
          } else if (route.name === 'Monthly') {
            iconName = 'table-chart';
          } else if (route.name === 'Analytics') {
            iconName = 'analytics';
          } else {
            iconName = 'help';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.header,
          borderTopColor: colors.borderStrong,
        },
        headerShown: false,
        headerStyle: {
          backgroundColor: colors.header,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Cattle" component={CattleListScreen} />
      <Tab.Screen name="Milk" component={MilkProductionScreen} />
      <Tab.Screen name="Feeding" component={FeedingScreen} />
      <Tab.Screen name="Financial" component={FinancialScreen} />
      <Tab.Screen name="Monthly" component={MonthlyReportScreen} options={{ title: 'Monthly Report' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
    </Tab.Navigator>
  );
};

const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: colors.header,
          },
          headerTintColor: colors.text,
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      >
        <Stack.Screen
          name="MainTabs"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="CattleDetail"
          component={CattleDetailScreen}
          options={{ title: 'Cattle Details' }}
        />
        <Stack.Screen
          name="AddCattle"
          component={AddCattleScreen}
          options={{ title: 'Add New Cattle' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ title: 'Farm Settings' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
