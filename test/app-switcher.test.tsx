// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppSwitcher, APPS } from '../ui/index.js';

// No vitest globals here, so Testing Library cannot register its own cleanup.
afterEach(cleanup);

function setup(props: Partial<Parameters<typeof AppSwitcher>[0]> = {}) {
  const user = userEvent.setup();
  render(
    <div>
      <AppSwitcher current="budget" icon={<svg data-testid="brand" />} label="Budget" {...props} />
      <p>outside</p>
    </div>,
  );
  return { user, trigger: screen.getByRole('button', { name: /budget/i }) };
}

describe('AppSwitcher', () => {
  it('renders the brand with a chevron, and starts closed', () => {
    const { trigger } = setup();
    expect(screen.getByTestId('brand')).toBeInTheDocument();
    expect(screen.getByTestId('app-switcher-chevron')).toHaveClass('opacity-0', 'group-hover:opacity-100');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens on click and links every other app to its registry URL', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    for (const app of APPS.filter((a) => a.id !== 'budget')) {
      expect(screen.getByRole('menuitem', { name: new RegExp(app.name) })).toHaveAttribute('href', app.url);
    }
  });

  it('marks the current app and does not link it', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    const current = screen.getAllByRole('menuitem').find((el) => el.getAttribute('aria-current') === 'page');
    expect(current).toHaveTextContent('Budget');
    expect(current?.tagName).not.toBe('A');
    expect(current).not.toHaveAttribute('href');
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('closes on a click outside', async () => {
    const { user, trigger } = setup();
    await user.click(trigger);
    await user.click(screen.getByText('outside'));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves focus with the arrow keys, skipping the current app and wrapping', async () => {
    const { user, trigger } = setup();
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const links = screen.getAllByRole('menuitem').filter((el) => el.tagName === 'A');
    expect(links[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    // links[1] is todo: budget, which sits between dashboard and todo, was skipped.
    expect(links[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(links.at(-1)).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(links[0]).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(links.at(-1)).toHaveFocus();
  });

  it('shows only the icon when collapsed, keeping the label for assistive tech', () => {
    setup({ collapsed: true });
    expect(screen.queryByTestId('app-switcher-chevron')).not.toBeInTheDocument();
    expect(screen.queryByText('Budget')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Budget' })).toHaveAttribute('title', 'Budget');
  });
});
