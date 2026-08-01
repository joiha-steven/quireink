import * as React from 'react';

/**
 * AdminI18nProvider — from quireink@2.0.0.
 */
export interface AdminI18nProviderProps {
lang: "vi" | "en" | "de" | "ja" | "zh" | "ko";
  children: ReactNode;
}

export declare const AdminI18nProvider: React.ComponentType<AdminI18nProviderProps>;
