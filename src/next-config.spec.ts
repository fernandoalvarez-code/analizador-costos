import { afterEach, describe, expect, it, vi } from 'vitest';
import nextConfig from '../next.config.mjs';

describe('next.config: /signup', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('en producción redirige /signup a /login', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(await nextConfig.redirects!()).toEqual([{ source: '/signup', destination: '/login', permanent: false }]);
  });

  it('en desarrollo no redirige (se sigue pudiendo probar en localhost)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(await nextConfig.redirects!()).toEqual([]);
  });
});
