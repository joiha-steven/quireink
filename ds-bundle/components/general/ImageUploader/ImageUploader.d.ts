import * as React from 'react';

/**
 * ImageUploader — from quireink@2.0.0.
 */
export interface ImageUploaderProps {
onUploaded: (items: MediaItem[]) => void;
}

export declare const ImageUploader: React.ComponentType<ImageUploaderProps>;
