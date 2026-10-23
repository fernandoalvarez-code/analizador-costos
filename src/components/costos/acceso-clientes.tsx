"use client";

import React, { useCallback, useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useFirestore, useUser } from '@/firebase';
import { llamarApiCostos } from '@/lib/client/costos-api';

// Panel "Acceso de clientes" (solo admin SECOCUT): invitaciones a la empresa y vendedores asignados. Todo pasa por las rutas
// /api/costos/** (el servidor es el único que escribe empresaId y empresasAsignadas). Los estados de guardado son reales:
// inactivo → guardando → guardado / error, y los errores se muestran siempre.

const CLASE_TARJETA = 'rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6';
const CLASE_SUBTITULO = 'text-sm font-bold text-slate-800';
const CLASE_FILA = 'flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm';
const CLASE_OK = 'text-sm font-medium text-green-700';
const CLASE_ERROR = 'text-sm font-medium text-red-700';
const CLASE_NEUTRO = 'text-sm text-slate-500';

type Guardado = { fase: 'inactivo' } | { fase: 'guardando' } | { fase: 'guardado'; mensaje: string } | { fase: 'error'; mensaje: string };
const INACTIVO: Guardado = { fase: 'inactivo' };

function EstadoGuardado({ g, testId }: { g: Guardado; testId: string }) {
  if (g.fase === 'inactivo') return null;
  if (g.fase === 'guardando') return <p data-testid={testId} role="status" className={CLASE_NEUTRO}>Guardando…</p>;
  if (g.fase === 'guardado') return <p data-testid={testId} role="status" className={CLASE_OK}>{g.mensaje}</p>;
  return <p data-testid={testId} role="alert" className={CLASE_ERROR}>{g.mensaje}</p>;
}

interface InvitacionFila { id: string; email: string; estado: 'pendiente' | 'usada' | 'vencida'; createdAt: string; expiresAt: string; usadaAt: string | null }
const ROTULO_ESTADO: Record<InvitacionFila['estado'], string> = { pendiente: 'Pendiente', usada: 'Usada', vencida: 'Vencida' };
const CLASE_ESTADO: Record<InvitacionFila['estado'], string> = {
  pendiente: 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800',
  usada: 'rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800',
  vencida: 'rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600',
};
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

interface Vendedor { uid: string; email: string }

export default function AccesoClientes({ empresaId }: { empresaId: string }) {
  const { user } = useUser();
  const firestore = useFirestore();

  const [invitaciones, setInvitaciones] = useState<InvitacionFila[] | null>(null);
  const [errorLista, setErrorLista] = useState<string | null>(null);
  const [emailInvitado, setEmailInvitado] = useState('');
  const [guardadoInvitar, setGuardadoInvitar] = useState<Guardado>(INACTIVO);
  const [revocando, setRevocando] = useState<string | null>(null);
  const [guardadoRevocar, setGuardadoRevocar] = useState<Guardado>(INACTIVO);

  const [vendedores, setVendedores] = useState<Vendedor[] | null>(null);
  const [errorVendedores, setErrorVendedores] = useState<string | null>(null);
  const [emailVendedor, setEmailVendedor] = useState('');
  const [guardadoVendedor, setGuardadoVendedor] = useState<Guardado>(INACTIVO);

  const cargarInvitaciones = useCallback(async () => {
    if (!user) return;
    const r = await llamarApiCostos<{ invitaciones: InvitacionFila[] }>(user, `/api/costos/invitaciones?empresaId=${encodeURIComponent(empresaId)}`);
    if (!r.ok || !r.data) { setErrorLista('No se pudieron cargar las invitaciones.'); return; }
    setErrorLista(null);
    setInvitaciones(r.data.invitaciones);
  }, [user, empresaId]);

  const cargarVendedores = useCallback(async () => {
    if (!firestore) return;
    try {
      const snap = await getDocs(query(collection(firestore, 'users'), where('empresasAsignadas', 'array-contains', empresaId)));
      setErrorVendedores(null);
      setVendedores(snap.docs.map((d) => ({ uid: d.id, email: String(d.get('email') ?? d.id) })).sort((a, b) => a.email.localeCompare(b.email)));
    } catch {
      setErrorVendedores('No se pudieron cargar los vendedores asignados.');
    }
  }, [firestore, empresaId]);

  useEffect(() => { cargarInvitaciones(); }, [cargarInvitaciones]);
  useEffect(() => { cargarVendedores(); }, [cargarVendedores]);

  const invitar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const email = emailInvitado.trim();
    if (!email) { setGuardadoInvitar({ fase: 'error', mensaje: 'Ingresá el email de la persona a invitar.' }); return; }
    setGuardadoInvitar({ fase: 'guardando' });
    const r = await llamarApiCostos<{ id: string; expiresAt: string }>(user, '/api/costos/invitaciones', { method: 'POST', body: { empresaId, email } });
    if (!r.ok) {
      setGuardadoInvitar({ fase: 'error', mensaje: r.status === 400 ? 'Revisá el email ingresado.' : 'No se pudo crear la invitación. Reintentá.' });
      return;
    }
    setGuardadoInvitar({ fase: 'guardado', mensaje: `Invitación lista (vence el ${r.data ? fecha(r.data.expiresAt) : '—'}). La persona debe ingresar con ese email, verificarlo y aceptarla en Costos.` });
    setEmailInvitado('');
    await cargarInvitaciones();
  };

  const revocar = async (id: string) => {
    if (!user) return;
    setRevocando(id);
    setGuardadoRevocar({ fase: 'guardando' });
    const r = await llamarApiCostos(user, `/api/costos/invitaciones/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setRevocando(null);
    if (!r.ok) { setGuardadoRevocar({ fase: 'error', mensaje: 'No se pudo revocar la invitación. Reintentá.' }); await cargarInvitaciones(); return; }
    setGuardadoRevocar({ fase: 'guardado', mensaje: 'Invitación revocada.' });
    await cargarInvitaciones();
  };

  const cambiarVendedor = async (email: string, accion: 'asignar' | 'quitar') => {
    if (!user) return;
    const limpio = email.trim();
    if (!limpio) { setGuardadoVendedor({ fase: 'error', mensaje: 'Ingresá el email del vendedor.' }); return; }
    setGuardadoVendedor({ fase: 'guardando' });
    const r = await llamarApiCostos(user, '/api/costos/vendedores', { method: 'POST', body: { email: limpio, empresaId, accion } });
    if (!r.ok) {
      setGuardadoVendedor({
        fase: 'error',
        mensaje: r.status === 400
          ? 'Revisá el email ingresado.'
          : r.status === 404
            ? 'No se pudo: debe ser una cuenta @secocut.com con el email verificado que ya haya ingresado a la app.'
            : 'No se pudo guardar el cambio. Reintentá.',
      });
      return;
    }
    setGuardadoVendedor({ fase: 'guardado', mensaje: accion === 'asignar' ? 'Vendedor asignado.' : 'Vendedor quitado.' });
    if (accion === 'asignar') setEmailVendedor('');
    await cargarVendedores();
  };

  const guardandoVendedor = guardadoVendedor.fase === 'guardando';

  return (
    <section className={CLASE_TARJETA} data-testid="acceso-clientes" aria-label="Acceso de clientes">
      <h2 className="text-lg font-bold text-slate-800">Acceso de clientes</h2>

      <div className="space-y-3">
        <h3 className={CLASE_SUBTITULO}>Invitar por email</h3>
        <form onSubmit={invitar} className="flex flex-wrap items-center gap-2">
          <Input
            type="email" aria-label="Email a invitar" placeholder="persona@empresa.com" className="max-w-sm"
            value={emailInvitado} onChange={(e) => setEmailInvitado(e.target.value)}
          />
          <Button type="submit" disabled={guardadoInvitar.fase === 'guardando'}>{guardadoInvitar.fase === 'guardando' ? 'Invitando…' : 'Invitar'}</Button>
        </form>
        <EstadoGuardado g={guardadoInvitar} testId="estado-invitar" />

        <h3 className={CLASE_SUBTITULO}>Invitaciones</h3>
        {errorLista && <p data-testid="error-invitaciones" role="alert" className={CLASE_ERROR}>{errorLista} <button type="button" className="underline" onClick={cargarInvitaciones}>Reintentar</button></p>}
        {!errorLista && invitaciones === null && <p className={CLASE_NEUTRO}>Cargando invitaciones…</p>}
        {invitaciones && invitaciones.length === 0 && <p className={CLASE_NEUTRO}>Todavía no hay invitaciones.</p>}
        {invitaciones && invitaciones.length > 0 && (
          <ul className="space-y-2" data-testid="lista-invitaciones">
            {invitaciones.map((i) => (
              <li key={i.id} className={CLASE_FILA} data-testid={`invitacion-${i.id}`}>
                <span>{i.email}</span>
                <span className="flex items-center gap-3">
                  <span className={CLASE_ESTADO[i.estado]}>{ROTULO_ESTADO[i.estado]}</span>
                  <span className="text-xs text-slate-500">{i.estado === 'usada' && i.usadaAt ? `Usada el ${fecha(i.usadaAt)}` : `Vence el ${fecha(i.expiresAt)}`}</span>
                  {i.estado === 'pendiente' && (
                    <Button type="button" variant="outline" size="sm" disabled={revocando === i.id} onClick={() => revocar(i.id)}>
                      {revocando === i.id ? 'Revocando…' : 'Revocar'}
                    </Button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        <EstadoGuardado g={guardadoRevocar} testId="estado-revocar" />
      </div>

      <div className="space-y-3">
        <h3 className={CLASE_SUBTITULO}>Vendedores asignados</h3>
        {errorVendedores && <p data-testid="error-vendedores" role="alert" className={CLASE_ERROR}>{errorVendedores} <button type="button" className="underline" onClick={cargarVendedores}>Reintentar</button></p>}
        {!errorVendedores && vendedores === null && <p className={CLASE_NEUTRO}>Cargando vendedores…</p>}
        {vendedores && vendedores.length === 0 && <p className={CLASE_NEUTRO}>No hay vendedores asignados a esta empresa.</p>}
        {vendedores && vendedores.length > 0 && (
          <ul className="space-y-2" data-testid="lista-vendedores">
            {vendedores.map((v) => (
              <li key={v.uid} className={CLASE_FILA}>
                <span>{v.email}</span>
                <Button type="button" variant="outline" size="sm" disabled={guardandoVendedor} onClick={() => cambiarVendedor(v.email, 'quitar')}>Quitar</Button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={(e) => { e.preventDefault(); cambiarVendedor(emailVendedor, 'asignar'); }} className="flex flex-wrap items-center gap-2">
          <Input
            type="email" aria-label="Email del vendedor" placeholder="vendedor@secocut.com" className="max-w-sm"
            value={emailVendedor} onChange={(e) => setEmailVendedor(e.target.value)}
          />
          <Button type="submit" disabled={guardandoVendedor}>{guardandoVendedor ? 'Guardando…' : 'Agregar'}</Button>
        </form>
        <EstadoGuardado g={guardadoVendedor} testId="estado-vendedor" />
      </div>
    </section>
  );
}
