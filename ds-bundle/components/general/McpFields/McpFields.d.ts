import * as React from 'react';

/**
 * McpFields — from quireink@2.0.0.
 */
export interface McpFieldsProps {
mcp: McpSettings;
  siteUrl: string;
  onChange: (m: McpSettings) => void;
}

export declare const McpFields: React.ComponentType<McpFieldsProps>;
