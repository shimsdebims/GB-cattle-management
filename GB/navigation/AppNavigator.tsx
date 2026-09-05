import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';

// Import screens
import DashboardScreen from '../screens/DashboardScreen';
import CattleListScreen from '../screens/CattleListScreen';
import CattleDetailScreen from '../screens/CattleDetailScreen';
import AddCattleScreen from '../screens/AddCattleScreen';
import MilkProductionScreen from '../screens/MilkProductionScreen';
import FeedingScreen from '../screens/FeedingScreen';
import FinancialScreen from '../screens/FinancialScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';

export type RootStackParamList = {
  MainTabs: undefined;
  CattleDetail: { cattleId: string };
  AddCattle: undefined;
  EditCattle: { cattleId: string };
};

export type MainTabParamList = {
  Dashboard: undefined;
  Cattle: undefined;
  Milk: undefined;
  Feeding: undefined;
  Financial: undefined;
  Analytics: undefined;
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
          } else if (route.name === 'Analytics') {
            iconName = 'analytics';
          } else {
            iconName = 'help';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#00ED64',
        tabBarInactiveTintColor: '#C1C7CD',
        tabBarStyle: {
          backgroundColor: '#00374A',
          borderTopColor: '#394F56',
        },
        headerStyle: {
          backgroundColor: '#00374A',
        },
        headerTintColor: '#FFFFFF',
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
            backgroundColor: '#00374A',
          },
          headerTintColor: '#FFFFFF',
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
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
