import 'server-only';
import dns from 'node:dns';
import https from 'node:https';
import net from 'node:net';
import { Readable } from 'node:stream';

/**
 * Descarga de páginas externas con protección contra SSRF (el servidor no debe poder usarse para
 * llegar a la red interna ni al servicio de metadatos de la nube).
 *
 * - Solo https, sin credenciales en la URL y solo puerto 443.
 * - Se bloquean destinos de IP privada, loopback, link-local (incluye 169.254.169.254), CGNAT,
 *   multicast, reservadas y los nombres locales (localhost, *.local, *.internal, nombres sin punto).
 * - La IP se valida en el MOMENTO de conectar (lookup propio): no hay ventana entre "validar" y
 *   "conectar" para un DNS rebinding. Si un nombre resuelve a varias IP y alguna es bloqueada, se rechaza.
 * - NO se siguen redirecciones: una 3xx se informa y listo (una redirección podría apuntar a un destino interno).
 * - Tiempo máximo y tamaño máximo de respuesta.
 */

export class UnsafeUrlError extends Error {
  constructor(message = 'Destino no permitido') {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

// ── IPv4 ───────────────────────────────────────────────────────────────────────────────────

function parseIPv4(ip: string): number[] | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return octets.some((o) => Number.isNaN(o) || o > 255) ? null : octets;
}

function isBlockedIPv4Octets([a, b, c]: number[]): boolean {
  return (
    a === 0 ||                                  // 0.0.0.0/8 "esta red"
    a === 10 ||                                 // 10.0.0.0/8 privada
    (a === 100 && b >= 64 && b <= 127) ||       // 100.64.0.0/10 CGNAT
    a === 127 ||                                // 127.0.0.0/8 loopback
    (a === 169 && b === 254) ||                 // 169.254.0.0/16 link-local (metadatos de la nube)
    (a === 172 && b >= 16 && b <= 31) ||        // 172.16.0.0/12 privada
    (a === 192 && b === 0 && c === 0) ||        // 192.0.0.0/24 protocolo IETF
    (a === 192 && b === 0 && c === 2) ||        // 192.0.2.0/24 documentación
    (a === 192 && b === 168) ||                 // 192.168.0.0/16 privada
    (a === 198 && (b === 18 || b === 19)) ||    // 198.18.0.0/15 pruebas de red
    (a === 198 && b === 51 && c === 100) ||     // 198.51.100.0/24 documentación
    (a === 203 && b === 0 && c === 113) ||      // 203.0.113.0/24 documentación
    a >= 224                                    // 224.0.0.0/4 multicast, 240.0.0.0/4 reservada, broadcast
  );
}

// ── IPv6 ───────────────────────────────────────────────────────────────────────────────────

function parseIPv6(input: string): number[] | null {
  let s = input.toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);

  let tail: number[] | null = null;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const o = parseIPv4(v4[1]);
    if (!o) return null;
    tail = [(o[0] << 8) | o[1], (o[2] << 8) | o[3]];
    s = s.slice(0, -v4[1].length) + '0:0';
  }

  const halves = s.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const rest = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  let groups: string[];
  if (halves.length === 2) {
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill('0'), ...rest];
  } else {
    groups = head;
  }
  if (groups.length !== 8) return null;

  const nums = groups.map((g) => (/^[0-9a-f]{1,4}$/.test(g) ? parseInt(g, 16) : NaN));
  if (nums.some(Number.isNaN)) return null;
  if (tail) { nums[6] = tail[0]; nums[7] = tail[1]; }
  return nums;
}

function embeddedV4(hi: number, lo: number): number[] {
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff];
}

function isBlockedIPv6(g: number[]): boolean {
  // IPv4 mapeada (::ffff:a.b.c.d): vale lo que valga la IPv4.
  if (g.slice(0, 5).every((x) => x === 0) && g[5] === 0xffff) return isBlockedIPv4Octets(embeddedV4(g[6], g[7]));
  // NAT64 (64:ff9b::/96): la IPv4 embebida.
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedIPv4Octets(embeddedV4(g[6], g[7]));
  // 6to4 (2002::/16): la IPv4 embebida en los grupos 1 y 2.
  if (g[0] === 0x2002) return isBlockedIPv4Octets(embeddedV4(g[1], g[2]));
  // Solo se admite unicast global (2000::/3). Deja afuera ::, ::1, fe80::/10, fc00::/7, ff00::/8, ::/96, etc.
  if ((g[0] & 0xe000) !== 0x2000) return true;
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 documentación
  if (g[0] === 0x2001 && g[1] === 0x0000) return true; // 2001::/32 Teredo
  return false;
}

/** true si la IP (v4 o v6) NO es un destino público permitido. Una cadena que no es IP también se bloquea. */
export function isBlockedIp(ip: string): boolean {
  const clean = ip.replace(/^\[|\]$/g, '');
  const family = net.isIP(clean);
  if (family === 4) {
    const o = parseIPv4(clean);
    return !o || isBlockedIPv4Octets(o);
  }
  if (family === 6) {
    const g = parseIPv6(clean);
    return !g || isBlockedIPv6(g);
  }
  return true;
}

// ── URL y resolución ───────────────────────────────────────────────────────────────────────

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.localdomain', '.lan', '.home.arpa'];

/** Valida la URL sin tocar la red. El parser de URL ya normaliza formas como 2130706433 o 0x7f.1 a 127.0.0.1. */
export function assertPublicHttpsUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('URL inválida');
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('Solo https');
  if (url.username || url.password) throw new UnsafeUrlError('La URL no puede llevar credenciales');
  if (url.port && url.port !== '443') throw new UnsafeUrlError('Puerto no permitido');

  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host) throw new UnsafeUrlError('Host vacío');
  if (net.isIP(host)) {
    if (isBlockedIp(host)) throw new UnsafeUrlError('IP no permitida');
    return url;
  }
  if (host === 'localhost' || !host.includes('.') || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError('Nombre de host no permitido');
  }
  return url;
}

type LookupResult = { address: string; family: number };
type Resolver = (hostname: string) => Promise<LookupResult[]>;

const defaultResolver: Resolver = (hostname) =>
  new Promise((resolve, reject) => {
    dns.lookup(hostname, { all: true, verbatim: true }, (err, addresses) => (err ? reject(err) : resolve(addresses)));
  });

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | LookupResult[], family?: number) => void;

/**
 * `lookup` para https.request: resuelve el nombre y rechaza si CUALQUIER dirección es bloqueada.
 * Devuelve la dirección ya validada, que es a la que se conecta el socket (sin segunda resolución).
 */
export function createSafeLookup(resolve: Resolver = defaultResolver) {
  return (hostname: string, options: { all?: boolean } | undefined, callback: LookupCallback) => {
    resolve(hostname).then(
      (addresses) => {
        if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
          callback(new UnsafeUrlError('El nombre resuelve a una dirección no permitida') as NodeJS.ErrnoException);
          return;
        }
        if (options?.all) callback(null, addresses);
        else callback(null, addresses[0].address, addresses[0].family);
      },
      (err) => callback(err),
    );
  };
}

// ── Descarga ───────────────────────────────────────────────────────────────────────────────

export type SafeFetchResult =
  | { kind: 'ok'; status: number; text: string }
  | { kind: 'redirect'; status: number }
  | { kind: 'http-error'; status: number };

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  /** Solo para tests. */
  request?: typeof https.request;
  resolver?: Resolver;
};

export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const { timeoutMs = 10_000, maxBytes = 2_000_000, request = https.request, resolver } = options;
  const url = assertPublicHttpsUrl(rawUrl); // lanza UnsafeUrlError antes de abrir ninguna conexión

  return new Promise<SafeFetchResult>((resolve, reject) => {
    const req = request(
      url,
      {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SECOCUTBot/1.0)', Accept: 'text/html,text/plain;q=0.9' },
        lookup: createSafeLookup(resolver) as unknown as net.LookupFunction,
        timeout: timeoutMs,
        agent: false,
      },
      (res: Readable & { statusCode?: number }) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) { res.resume(); resolve({ kind: 'redirect', status }); return; } // no se siguen redirecciones
        if (status < 200 || status >= 300) { res.resume(); resolve({ kind: 'http-error', status }); return; }

        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            chunks.push(chunk.subarray(0, chunk.length - (size - maxBytes)));
            res.destroy(); // alcanzó el tope: se usa lo recibido hasta acá
            return;
          }
          chunks.push(chunk);
        });
        const finish = () => resolve({ kind: 'ok', status, text: Buffer.concat(chunks).toString('utf8') });
        res.on('end', finish);
        res.on('close', finish); // también cuando se corta por el tope de tamaño
        res.on('error', () => finish());
      },
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', (err: Error) => reject(err));
    req.end();
  });
}
