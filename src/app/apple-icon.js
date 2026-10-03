import { appIcon } from '@/lib/appIcon';

// Home-screen icon for iOS, which ignores the manifest icons.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return appIcon(180);
}
