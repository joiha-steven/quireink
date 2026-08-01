import * as React from 'react';

/**
 * Card — from quireink@2.0.0.
 */
export interface CardProps {
title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export declare const Card: React.ComponentType<CardProps>;
