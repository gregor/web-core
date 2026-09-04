import { useEffect, useState } from 'react';
// Imported via the alias on purpose: this is what proves `paths` resolves to the
// app's own src/ and not into node_modules/@gregor_herdmann/web-core/src.
import { greet } from '@/lib/util';

export default function App() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setMsg(greet('world'));
  }, []);
  return <p>{msg}</p>;
}
