import Harness from './Harness';
import './proto.css';
import './picker.css';

// Throwaway prototype route: three header directions behind a picker.
// Delete this folder once a variant is chosen.
export const metadata = { title: 'Header prototypes', robots: { index: false } };

export default async function HeaderPrototypes({ searchParams }) {
  const v = parseInt((await searchParams).v, 10);
  return <Harness initial={v >= 1 && v <= 3 ? v - 1 : 0} />;
}
