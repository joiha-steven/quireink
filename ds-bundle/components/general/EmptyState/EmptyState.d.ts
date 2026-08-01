import * as React from 'react';

/**
 * EmptyState — from quireink@2.0.0.
 */
export interface EmptyStateProps {
title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export declare const EmptyState: React.ComponentType<EmptyStateProps>;
