import { notFound } from 'next/navigation';
import { appIcon } from '@/lib/appIcon';

// Install icons for the web app manifest, rendered once at build time.
const ICON_SIZES = [192, 512];
export const dynamicParams = false;
export const generateStaticParams = () => ICON_SIZES.map((size) => ({ size: String(size) }));

export async function GET(_request, { params }) {
  const size = Number((await params).size);
  if (!ICON_SIZES.includes(size)) notFound();
  return appIcon(size);
}
