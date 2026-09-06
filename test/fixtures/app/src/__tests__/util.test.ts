// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { greet } from '@/lib/util';

describe('greet', () => {
  it('greets by name', () => {
    expect(greet('world')).toBe('hello world');
  });
});
