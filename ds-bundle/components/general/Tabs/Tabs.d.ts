import * as React from 'react';

/**
 * Tabs — from quireink@2.0.0.
 */
export interface TabsProps {
tabs: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  variant?: "underline" | "segment";
  className?: string;
}

export declare const Tabs: React.ComponentType<TabsProps>;
