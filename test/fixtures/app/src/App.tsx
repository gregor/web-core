import { useEffect, useState } from 'react';
// Imported from the packed tarball: proves the `./ui` export, its .d.ts, and that
// react/lucide-react resolve from the compiled output inside node_modules.
import { AppShell, Button, Modal } from '@gregor_herdmann/web-core/ui';
import { MemoryRouter } from 'react-router-dom';
import { House } from 'lucide-react';
// Imported via the alias on purpose: this is what proves `paths` resolves to the
// app's own src/ and not into node_modules/@gregor_herdmann/web-core/src.
import { greet } from '@/lib/util';

export default function App() {
  const [msg, setMsg] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setMsg(greet('world'));
  }, []);
  return (
    <MemoryRouter>
      <AppShell
        app={{ id: 'budget', icon: <span />, label: 'Fixture' }}
        nav={[{ to: '/', label: 'Home', icon: House }]}
        labels={{
          navigation: 'Main',
          collapse: 'Collapse',
          expand: 'Expand',
          lightMode: 'Light mode',
          darkMode: 'Dark mode',
        }}
      >
        <Button onClick={() => setOpen(true)}>Open</Button>
        <Modal open={open} onClose={() => setOpen(false)} title="Fixture" closeLabel="Close">
          <p>{msg}</p>
        </Modal>
        <p>{msg}</p>
      </AppShell>
    </MemoryRouter>
  );
}
