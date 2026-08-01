import * as React from 'react';

/**
 * PostForm — from quireink@2.0.0.
 */
export interface PostFormProps {
initial?: PostWithContent;
  allCategories: string[];
  allTags: string[];
  allSeries: string[];
  contentWidth: number;
  typewriterEffects: boolean;
}

export declare const PostForm: React.ComponentType<PostFormProps>;
