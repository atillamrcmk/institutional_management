import { Tabs } from 'expo-router';
import { TabBarIcon, tabBarScreenOptions } from '@/shared/components/layout/TabBarIcon';

export default function PersonnelTabLayout() {
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
        name="shift"
        options={{
          title: 'Kurumda',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="people-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Görevlerim',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="clipboard-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Takvim',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="calendar-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Mesajlar',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="mail-outline" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person-outline" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
