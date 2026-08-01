import * as React from 'react';

/**
 * PageHeader — from quireink@2.0.0.
 */
export interface PageHeaderProps {
title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export declare const PageHeader: React.ComponentType<PageHeaderProps>;
