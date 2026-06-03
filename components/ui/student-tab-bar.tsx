'use client';

import React from 'react';
import { workspaceConfigs } from '@/lib/workspace';
import { MobileTabBar } from './mobile-tab-bar';

type StudentTabBarProps = {
  navigateWithTransition: (
    event: React.MouseEvent<HTMLAnchorElement>,
    targetPath: string,
  ) => void;
  pathname: string;
  warmRoute: (targetPath: string) => void;
};

export function StudentTabBar({
  navigateWithTransition,
  pathname,
  warmRoute,
}: StudentTabBarProps) {
  const items = workspaceConfigs.student.navItems.filter(
    (item) => item.mobile === 'tab',
  );

  return (
    <MobileTabBar
      items={items}
      pathname={pathname}
      rootPath={workspaceConfigs.student.rootPath}
      navigateWithTransition={navigateWithTransition}
      warmRoute={warmRoute}
    />
  );
}
