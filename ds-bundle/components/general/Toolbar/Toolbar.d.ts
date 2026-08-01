import * as React from 'react';

/**
 * Toolbar — from quireink@2.0.0.
 */
export interface ToolbarProps {
editor: TiptapEditor;
  onPickImage: () => void;
  onPickGallery: () => void;
  raw: boolean;
  onToggleRaw: () => void;
  stickyTop: number;
}

export declare const Toolbar: React.ComponentType<ToolbarProps>;
