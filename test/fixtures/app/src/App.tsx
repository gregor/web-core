import { useEffect, useState } from 'react';
// Imported from the packed tarball: proves the `./ui` export, its .d.ts, and that
// react/lucide-react resolve from the compiled output inside node_modules.
import { AppSwitcher } from '@gregor_herdmann/web-core/ui';
// Imported via the alias on purpose: this is what proves `paths` resolves to the
// app's own src/ and not into node_modules/@gregor_herdmann/web-core/src.
import { greet } from '@/lib/util';

export default function App() {
  const [msg, setMsg] = useState('');
  useEffect(() => {
    setMsg(greet('world'));
  }, []);
  return (
    <>
      <AppSwitcher current="budget" icon={<span />} label="Fixture" />
      <p>{msg}</p>
    </>
  );
}
