import * as React from 'react';

/**
 * RowActions — from quireink@2.0.0.
 */
export interface RowActionsProps {
editHref: string;
  viewHref?: string;
  onDelete: () => void;
}

export declare const RowActions: React.ComponentType<RowActionsProps>;
