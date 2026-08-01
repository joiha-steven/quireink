import * as React from 'react';

/**
 * AdminSidebar — from quireink@2.0.0.
 */
export interface AdminSidebarProps {
lang: "vi" | "en" | "de" | "ja" | "zh" | "ko";
  signOut: () => Promise<void>;
}

export declare const AdminSidebar: React.ComponentType<AdminSidebarProps>;
