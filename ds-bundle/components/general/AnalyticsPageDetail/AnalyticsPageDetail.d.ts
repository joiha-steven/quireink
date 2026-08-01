import * as React from 'react';

/**
 * AnalyticsPageDetail — from quireink@2.0.0.
 */
export interface AnalyticsPageDetailProps {
data: PageSummary;
  title: string;
  range: 1 | 7 | 30 | 365;
}

export declare const AnalyticsPageDetail: React.ComponentType<AnalyticsPageDetailProps>;
