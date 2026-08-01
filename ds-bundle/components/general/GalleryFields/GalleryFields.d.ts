import * as React from 'react';

/**
 * GalleryFields — from quireink@2.0.0.
 */
export interface GalleryFieldsProps {
gallery: GallerySettings;
  onChange: (g: GallerySettings) => void;
}

export declare const GalleryFields: React.ComponentType<GalleryFieldsProps>;
