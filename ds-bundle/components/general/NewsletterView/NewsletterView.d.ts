import * as React from 'react';

/**
 * NewsletterView — from quireink@2.0.0.
 */
export interface NewsletterViewProps {
posts: SendablePost[];
  mailConfigured: boolean;
}

export declare const NewsletterView: React.ComponentType<NewsletterViewProps>;
