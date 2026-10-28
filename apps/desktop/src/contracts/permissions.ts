export type PermissionKind = 'screen' | 'accessibility' | 'calendar' | 'files';
export type DragPermissionKind = Exclude<PermissionKind, 'calendar'>;
export interface PermissionStatus {
  screen: string;
  accessibility: string;
  calendar: string;
  appPath?: string;
  bundleId?: string;
  canDrag?: boolean;
}
