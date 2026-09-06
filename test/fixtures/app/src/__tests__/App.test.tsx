import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App.tsx';

describe('App', () => {
  it('renders the greeting produced in an effect', async () => {
    render(<App />);
    // toBeInTheDocument comes from jest-dom, wired in by web-core's setup file.
    expect(await screen.findByText('hello world')).toBeInTheDocument();
  });
});
