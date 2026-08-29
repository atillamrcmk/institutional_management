import { Tabs } from 'expo-router';
import { TabBarIcon, tabBarScreenOptions } from '@/shared/components/layout/TabBarIcon';

export default function AdminTabLayout() {
  return (
    <Tabs screenOptions={tabBarScreenOptions()}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Ana Sayfa',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="home-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="planning"
        options={{
          title: 'Planlama',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="analytics-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Görevler',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="clipboard-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="personnel"
        options={{
          title: 'Personel',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="people-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'Daha Fazla',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="menu-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
