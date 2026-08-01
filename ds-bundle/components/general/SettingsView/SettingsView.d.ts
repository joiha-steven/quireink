import * as React from 'react';

/**
 * SettingsView — from quireink@2.0.0.
 */
export interface SettingsViewProps {
settings: SiteSettings;
  presets: ThemePreset[];
  commentEnv: CommentEnv;
  integrations: IntegrationStatus;
  posts: { slug: string; title: string; }[];
  pages: { slug: string; title: string; }[];
  categories: string[];
}

export declare const SettingsView: React.ComponentType<SettingsViewProps>;
