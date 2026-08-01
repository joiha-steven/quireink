import * as React from 'react';

/**
 * MediaLibrary — from quireink@2.0.0.
 */
export interface MediaLibraryProps {
mode?: "page" | "picker";
  multi?: boolean;
  onSelect?: ((url: string) => void);
  onSelectMany?: ((urls: string[]) => void);
  onClose?: (() => void);
}

export declare const MediaLibrary: React.ComponentType<MediaLibraryProps>;
