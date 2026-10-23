import { describe, expect, it } from 'vitest';
import { requireNotEmpresaCliente } from '@/lib/server/perimetro-cliente';

const cliente = { uid: 'u1', email: 'jefe@autopartes.test' };
const staff = { uid: 'u2', email: 'vendedor@secocut.com' };

describe('requireNotEmpresaCliente', () => {
  it('cliente con empresaId → 403 genérico', async () => {
    const r = await requireNotEmpresaCliente(cliente, async () => 'emp-a');
    expect(!r.ok && r.response.status).toBe(403);
    if (!r.ok) expect(await r.response.json()).toEqual({ error: 'Sin permisos' });
  });
  it.each([[undefined], [null], ['']])('sin empresaId (%s) → pasa', async (valor) => {
    expect((await requireNotEmpresaCliente(cliente, async () => valor)).ok).toBe(true);
  });
  it('falla cerrado: error de lectura → 403 sin filtrar el motivo', async () => {
    const r = await requireNotEmpresaCliente(cliente, async () => { throw new Error('detalle interno'); });
    expect(!r.ok && r.response.status).toBe(403);
    if (!r.ok) expect(JSON.stringify(await r.response.json())).not.toContain('detalle');
  });
  it('personal @secocut.com pasa aunque tenga empresaId, sin leer el perfil', async () => {
    let lecturas = 0;
    const r = await requireNotEmpresaCliente(staff, async () => { lecturas++; return 'emp-a'; });
    expect(r.ok).toBe(true);
    expect(lecturas).toBe(0);
  });
  it('un dominio parecido (secocut.com.ar, fakesecocut.com) no cuenta como personal', async () => {
    expect((await requireNotEmpresaCliente({ uid: 'u3', email: 'x@secocut.com.ar' }, async () => 'emp-a')).ok).toBe(false);
  });
});
