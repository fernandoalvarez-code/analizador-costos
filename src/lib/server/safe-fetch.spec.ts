import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { assertPublicHttpsUrl, createSafeLookup, isBlockedIp, safeFetchText, UnsafeUrlError } from '@/lib/server/safe-fetch';

describe('isBlockedIp', () => {
  it.each([
    // IPv4: loopback, privadas, link-local (metadatos de la nube), CGNAT, reservadas
    '0.0.0.0', '10.0.0.1', '10.255.255.255', '127.0.0.1', '127.255.255.254', '169.254.169.254', '169.254.0.1',
    '172.16.0.1', '172.31.255.255', '192.168.0.1', '192.168.255.255', '100.64.0.1', '100.127.255.255',
    '198.18.0.1', '198.19.255.255', '192.0.0.1', '192.0.2.5', '198.51.100.1', '203.0.113.9',
    '224.0.0.1', '239.255.255.255', '240.0.0.1', '255.255.255.255',
    // IPv6: no global, loopback, link-local, ULA, multicast, documentación, Teredo
    '::', '::1', 'fe80::1', 'fe80::1%eth0', 'fc00::1', 'fd12:3456:789a::1', 'ff02::1', '2001:db8::1', '2001::1', '::10.0.0.1',
    // IPv6 con una IPv4 privada adentro (mapeada, NAT64, 6to4)
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', '::ffff:7f00:1', '::ffff:169.254.169.254', '64:ff9b::a00:1', '64:ff9b::7f00:1', '2002:7f00:1::1', '2002:a9fe:a9fe::1',
  ])('bloquea %s', (ip) => { expect(isBlockedIp(ip)).toBe(true); });

  it.each([
    '8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.255.255', '172.32.0.1', '100.63.255.255', '100.128.0.1', '169.253.1.1', '198.20.0.1', '223.255.255.254',
    '2606:4700:4700::1111', '2001:4860:4860::8888', '2a00:1450:4001::1', '::ffff:8.8.8.8', '64:ff9b::808:808', '2002:808:808::1',
  ])('permite la IP pública %s', (ip) => { expect(isBlockedIp(ip)).toBe(false); });

  it('lo que no es una IP se bloquea', () => {
    expect(isBlockedIp('example.com')).toBe(true);
    expect(isBlockedIp('999.1.1.1')).toBe(true);
    expect(isBlockedIp('')).toBe(true);
  });
});

describe('assertPublicHttpsUrl', () => {
  it.each([
    'http://example.com/', 'ftp://example.com/', 'file:///etc/passwd', 'javascript:alert(1)', 'no es una url',
    'https://user:pass@example.com/', 'https://example.com:8443/', 'https://example.com:80/',
    'https://localhost/', 'https://localhost./', 'https://foo.localhost/', 'https://intranet/', 'https://printer.local/',
    'https://metadata.google.internal/computeMetadata/v1/', 'https://servidor.lan/',
    'https://127.0.0.1/', 'https://127.1/', 'https://[::1]/', 'https://[::ffff:127.0.0.1]/', 'https://10.1.2.3/', 'https://192.168.0.10/',
    'https://169.254.169.254/latest/meta-data/', 'https://[fe80::1]/', 'https://0.0.0.0/',
    'https://2130706433/', 'https://0x7f.0.0.1/', 'https://017700000001/', 'https://0177.0.0.1/',
  ])('rechaza %s', (u) => { expect(() => assertPublicHttpsUrl(u)).toThrow(UnsafeUrlError); });

  it.each(['https://example.com/catalogo', 'https://www.seco.com:443/x?y=1', 'https://8.8.8.8/', 'https://[2606:4700:4700::1111]/'])(
    'acepta %s', (u) => { expect(assertPublicHttpsUrl(u)).toBeInstanceOf(URL); });
});

describe('createSafeLookup (validación en el momento de conectar)', () => {
  const run = (resolve: () => Promise<{ address: string; family: number }[]>, opts: { all?: boolean } = {}) =>
    new Promise<{ err: unknown; address?: unknown; family?: unknown }>((done) => {
      createSafeLookup(resolve)('host.example.com', opts, (err, address, family) => done({ err, address, family }));
    });

  it('devuelve la dirección pública validada', async () => {
    expect(await run(async () => [{ address: '93.184.216.34', family: 4 }])).toEqual({ err: null, address: '93.184.216.34', family: 4 });
  });
  it('con all:true devuelve la lista (Node la pide así al conectar)', async () => {
    const r = await run(async () => [{ address: '93.184.216.34', family: 4 }], { all: true });
    expect(r.err).toBeNull();
    expect(r.address).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
  it('rechaza un nombre que resuelve a una IP privada (DNS rebinding)', async () => {
    expect((await run(async () => [{ address: '10.0.0.5', family: 4 }])).err).toBeInstanceOf(UnsafeUrlError);
    expect((await run(async () => [{ address: '169.254.169.254', family: 4 }])).err).toBeInstanceOf(UnsafeUrlError);
  });
  it('rechaza si UNA de varias direcciones es privada', async () => {
    const r = await run(async () => [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]);
    expect(r.err).toBeInstanceOf(UnsafeUrlError);
  });
  it('rechaza una resolución vacía y propaga los errores de DNS', async () => {
    expect((await run(async () => [])).err).toBeInstanceOf(UnsafeUrlError);
    expect((await run(async () => { throw new Error('ENOTFOUND'); })).err).toBeInstanceOf(Error);
  });
});

// Un https.request falso que ejecuta el `lookup` que recibe, como haría Node al abrir el socket.
function fakeRequest(opts: { status?: number; body?: string; headers?: Record<string, string> } = {}) {
  const calls: { url: URL; options: Record<string, unknown> }[] = [];
  const request = ((url: URL, options: Record<string, unknown>, cb: (res: Readable & { statusCode?: number }) => void) => {
    calls.push({ url, options });
    const req = new EventEmitter() as EventEmitter & { end: () => void; destroy: (e?: Error) => void };
    req.destroy = (e) => { if (e) req.emit('error', e); };
    req.end = () => {
      (options.lookup as (h: string, o: object, c: (e: Error | null) => void) => void)(url.hostname, {}, (err) => {
        if (err) { req.emit('error', err); return; }
        const res = Readable.from([Buffer.from(opts.body ?? '<html>ok</html>')]) as Readable & { statusCode?: number; headers?: unknown };
        res.statusCode = opts.status ?? 200;
        res.headers = opts.headers ?? {};
        cb(res);
      });
    };
    return req;
  }) as unknown as typeof import('node:https').request;
  return { request, calls };
}
const publicDns = async () => [{ address: '93.184.216.34', family: 4 }];

describe('safeFetchText', () => {
  it('devuelve el texto de una página pública', async () => {
    const f = fakeRequest({ body: '<html>catálogo</html>' });
    expect(await safeFetchText('https://example.com/a', { request: f.request, resolver: publicDns })).toEqual({ kind: 'ok', status: 200, text: '<html>catálogo</html>' });
    expect(f.calls[0].options.lookup).toBeTypeOf('function');
    expect(f.calls[0].options.agent).toBe(false);
  });

  it('NO sigue redirecciones: informa la 3xx y no hace una segunda request', async () => {
    const f = fakeRequest({ status: 302, headers: { location: 'https://169.254.169.254/latest/meta-data/' } });
    expect(await safeFetchText('https://example.com/a', { request: f.request, resolver: publicDns })).toEqual({ kind: 'redirect', status: 302 });
    expect(f.calls).toHaveLength(1);
  });

  it.each([301, 303, 307, 308])('la %i también se informa sin seguirla', async (status) => {
    const f = fakeRequest({ status });
    expect((await safeFetchText('https://example.com/a', { request: f.request, resolver: publicDns })).kind).toBe('redirect');
    expect(f.calls).toHaveLength(1);
  });

  it('un error HTTP se informa como http-error', async () => {
    const f = fakeRequest({ status: 404 });
    expect(await safeFetchText('https://example.com/a', { request: f.request, resolver: publicDns })).toEqual({ kind: 'http-error', status: 404 });
  });

  it('una IP privada o un nombre local se rechaza SIN abrir ninguna conexión', async () => {
    const f = fakeRequest();
    for (const u of ['https://127.0.0.1/', 'https://169.254.169.254/latest/meta-data/', 'https://10.0.0.1/', 'https://localhost/', 'https://[::1]/']) {
      await expect(safeFetchText(u, { request: f.request, resolver: publicDns })).rejects.toBeInstanceOf(UnsafeUrlError);
    }
    expect(f.calls).toHaveLength(0);
  });

  it('un nombre público que resuelve a una IP privada se rechaza al conectar (DNS rebinding)', async () => {
    const f = fakeRequest();
    await expect(safeFetchText('https://trampa.example.com/', { request: f.request, resolver: async () => [{ address: '10.0.0.5', family: 4 }] }))
      .rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('corta la respuesta en el tope de tamaño', async () => {
    const f = fakeRequest({ body: 'x'.repeat(5000) });
    const r = await safeFetchText('https://example.com/a', { request: f.request, resolver: publicDns, maxBytes: 1000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.text).toHaveLength(1000);
  });
});

