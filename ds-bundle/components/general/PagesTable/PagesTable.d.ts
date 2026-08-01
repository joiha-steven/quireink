import * as React from 'react';

/**
 * PagesTable — from quireink@2.0.0.
 */
export interface PagesTableProps {
initialPages: Page[];
  views: Record<string, number>;
}

export declare const PagesTable: React.ComponentType<PagesTableProps>;
