// @vitest-environment jsdom
import { cleanup, fireEvent, render, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PiezaEditor from '@/components/costos/pieza-editor';
import type { PiezaDoc } from '@/lib/costos-mecanizado/firestore';
import { REGLAS_POR_DEFECTO, type Implementacion, type LineaBase, type MejoraDescartada, type Pieza } from '@/lib/costos-mecanizado/types';
import { crearCarcasa } from '../../../tests/fixtures/costos-control';

// Claridad en descartes, mejoras realizadas y ahorro logrado (solo textos y estructura). Oráculos de CAR-001: 9,3570235 USD/pza, 25.000 piezas,
// 10 mejoras y USD 44.015 de potencial; sin la de Op20 (12.000) quedan 9 y USD 32.015; con Op20 al 80 % del corte el logrado es 12.363,75 ≈ 12.364.
// FRÁGIL: depende de los textos de diagnostico-pieza.tsx e implementaciones-dialogs.tsx.
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

const EMP = 'emp-a';
const USUARIO = { uid: 'u1', email: 'ana@secocut.com' };
const MAQUINAS = [
  { id: 'T1', nombre: 'Torno CNC 1', costoHora: 30 }, { id: 'CV1', nombre: 'Centro vertical 1', costoHora: 35 },
  { id: 'CV2', nombre: 'Centro vertical 2', costoHora: 35 }, { id: 'CH', nombre: 'Centro horizontal', costoHora: 45 },
  { id: 'M1', nombre: 'Máquina barata', costoHora: 1 },
];
const repo = { crearPieza: vi.fn(), actualizarPieza: vi.fn(), duplicarPieza: vi.fn(), listarTodosLosResumenes: vi.fn(), obtenerPieza: vi.fn() };
const NOTA = 'Se subió el avance de la fresa de alto avance';
const COSTO_BASE = 9.3570235;
const CLAVE_OP20 = 'Productividad|op20|';
const TODAS = [
  'Productividad|op20|', 'Herramienta|op30|op30-h1', 'Herramienta|op40|op40-h1', 'Herramienta|op10|op10-h1', 'Productividad|op50|',
  'Tiempos muertos|op10|', 'Tiempos muertos|op50|', 'Calidad|op30|', 'Calidad|op40|', 'Tiempos muertos|op30|',
];

const descarte = (ahorro = 12000): MejoraDescartada => ({
  motivoTipo: 'limitacion-maquina', motivo: 'La máquina no admite más avance', por: 'u9', porEmail: 'luis@secocut.com', fecha: '2026-10-20T15:00:00.000Z', ahorroAnualAlDescartar: ahorro,
});
const lineaBase = (over: Partial<LineaBase> = {}): LineaBase => ({ costoPiezaBase: COSTO_BASE, fecha: '2026-10-19T15:00:00.000Z', por: 'u9', porEmail: 'luis@secocut.com', volumenAnualBase: 25000, ...over });
const implementacion = (over: Partial<Implementacion> = {}): Implementacion => ({
  id: 'i1', categoria: 'Productividad', opId: 'op20', opNombre: 'Desbaste y contorno', claveMejora: CLAVE_OP20, titulo: 'El tiempo de corte domina la operación',
  fecha: '2026-10-20', nota: NOTA, por: 'u9', porEmail: 'luis@secocut.com', registradaEn: '2026-10-20T15:00:00.000Z', costoPiezaAntes: COSTO_BASE, ahorroEstimadoAnual: 12000, ...over,
});
const corteAl80 = (p: Pieza) => { for (const h of p.operaciones.find((o) => o.id === 'op20')!.herramientas) h.opciones[0].cortePorPiezaMin *= 0.8; };
const carcasa = (ajustar?: (p: Pieza) => void): PiezaDoc => { const p = crearCarcasa(); ajustar?.(p); return { ...p, id: 'car-001' } as PiezaDoc; };
/** Pieza "tranquila" escrita a mano: una operación con corte 44 %, tiempos muertos 44 % y herramienta 12 % del costo, a 1 USD/h: ninguna regla de mejora se dispara. */
const tranquila = (ajustar?: (p: Pieza) => void): PiezaDoc => {
  const p: Pieza = {
    codigo: 'Q-1', nombre: 'Tranquila', volumenAnual: 1000, modoProduccion: 'dedicada', material: { quienPone: 'propio', costoPorPieza: 0 },
    operaciones: [{
      id: 'opq', nombre: 'Op única', maquinaId: 'M1', tiemposMuertosMin: 0.44, setupMin: 0, scrapPct: 0,
      herramientas: [{ id: 'hq', seleccionada: 0, opciones: [{ id: 'oq', nombre: 'Herramienta', precio: 0.2, insertosPorHerramienta: 1, filosPorInserto: 1, piezasPorFilo: 100, cortePorPiezaMin: 0.44, cambioMin: 0 }] }],
    }],
  };
  ajustar?.(p);
  return { ...p, id: 'q-1' } as PiezaDoc;
};
const montar = (inicial: PiezaDoc = carcasa()) =>
  render(<PiezaEditor empresaId={EMP} repo={repo} inicial={inicial} maquinas={MAQUINAS} reglas={REGLAS_POR_DEFECTO} usuario={USUARIO} />);
type C = ReturnType<typeof render>;
const fechaLocal = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const dialogo = (id: string) => within(document.body).getByTestId(id);
const botonImplementada = (c: C, indice = 0) => within(c.getAllByTestId('mejora')[indice]).getByText('Marcar como implementada') as HTMLButtonElement;
const todasDescartadas = () => Object.fromEntries(TODAS.map((k) => [k, descarte(1000)]));

beforeEach(() => {
  Object.values(repo).forEach((f) => f.mockReset());
  repo.actualizarPieza.mockResolvedValue(undefined);
  repo.listarTodosLosResumenes.mockResolvedValue([]);
  repo.obtenerPieza.mockResolvedValue(null);
  push.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('la pieza "tranquila" de los tests no dispara ninguna mejora', () => {
  it('sin descartes ni implementaciones: el mensaje de siempre', () => {
    const c = montar(tranquila());
    expect(c.getByText('Con los datos cargados no hay mejoras que superen los umbrales.')).toBeTruthy();
    expect(c.queryByTestId('sin-mejoras-pendientes')).toBeNull();
  });
});

describe('1. aviso "logrado sin mejoras registradas"', () => {
  const AVISO = 'Hay ahorro sin mejoras registradas: registrá qué se cambió. Si fue una corrección de datos, rehacé la línea base.';
  it('logrado > 0 con 0 implementaciones: se muestra (informativo, no es una alerta de error)', () => {
    const c = montar(carcasa((p) => { corteAl80(p); p.lineaBase = lineaBase(); }));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 12.364');
    const aviso = c.getByTestId('aviso-logrado-sin-mejoras');
    expect(aviso.textContent).toBe(AVISO);
    expect(aviso.getAttribute('role')).toBeNull();
    expect(aviso.className).not.toContain('red');
  });
  it('con 1 o más implementaciones registradas: no se muestra', () => {
    const c = montar(carcasa((p) => { corteAl80(p); p.lineaBase = lineaBase(); p.implementaciones = [implementacion()]; }));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 12.364');
    expect(c.queryByTestId('aviso-logrado-sin-mejoras')).toBeNull();
  });
  it('con logrado 0 (la pieza no cambió desde la línea base): no se muestra', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); }));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD 0');
    expect(c.queryByTestId('aviso-logrado-sin-mejoras')).toBeNull();
  });
  it('con logrado negativo tampoco', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase({ costoPiezaBase: 9 }); }));
    expect(c.getByTestId('valor-logrado').textContent).toBe('USD −8.926');
    expect(c.queryByTestId('aviso-logrado-sin-mejoras')).toBeNull();
  });
});

describe('2. línea "Descartado (no aplicable)"', () => {
  it('una descartada vigente de USD 12.000 suma la línea; NO cambia el pendiente (32.015) ni el potencial total ni la barra', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); p.mejorasDescartadas = { [CLAVE_OP20]: descarte(12000) }; }));
    expect(c.getByTestId('descartado-anual').textContent).toBe('Descartado (no aplicable): USD 12.000/año');
    // 44.015 − 12.000 = 32.015 de pendiente; logrado 0 → potencial total 32.015; la barra en 0 %
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toBe('Logrado ≈ USD 0/año · Pendiente ≈ USD 32.015/año · Potencial total USD 32.015/año');
    expect(Number(c.getByRole('progressbar').getAttribute('aria-valuenow'))).toBe(0);
  });
  it('una descartada que ya no se dispararía (no vigente) no suma y no muestra la línea', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); p.mejorasDescartadas = { 'Calidad|op99|': descarte(5000) }; }));
    expect(c.queryByTestId('descartado-anual')).toBeNull();
  });
  it('con una vigente de 12.000 y una no vigente de 5.000 suma solo la vigente', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); p.mejorasDescartadas = { [CLAVE_OP20]: descarte(12000), 'Calidad|op99|': descarte(5000) }; }));
    expect(c.getByTestId('descartado-anual').textContent).toBe('Descartado (no aplicable): USD 12.000/año');
  });
  it('sin línea base la línea "Descartado" también se ve, junto al potencial', () => {
    const c = montar(carcasa((p) => { p.mejorasDescartadas = { [CLAVE_OP20]: descarte(12000) }; }));
    expect(c.getByTestId('descartado-anual').textContent).toBe('Descartado (no aplicable): USD 12.000/año');
    expect(c.getByTestId('potencial-sin-linea-base').textContent).toBe('Potencial ≈ USD 32.015/año (9 mejoras activas)');
  });
  it('sin descartes no hay línea', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); }));
    expect(c.queryByTestId('descartado-anual')).toBeNull();
  });
});

describe('2 bis. barra "de lo aplicable"', () => {
  it('pendiente 0 con descartes: "100 % de lo aplicable" y el aviso de que el resto se descartó (no un "100 %" suelto)', () => {
    const c = montar(carcasa((p) => { corteAl80(p); p.lineaBase = lineaBase(); p.mejorasDescartadas = todasDescartadas(); }));
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toBe('Logrado ≈ USD 12.364/año · Pendiente ≈ USD 0/año · Potencial total USD 12.364/año');
    expect(Number(c.getByRole('progressbar').getAttribute('aria-valuenow'))).toBe(100);
    expect(c.getByTestId('texto-barra').textContent).toBe('100 % de lo aplicable: el resto del potencial se descartó por no ser aplicable.');
    expect(c.getByTestId('descartado-anual').textContent).toBe('Descartado (no aplicable): USD 10.000/año'); // 10 descartadas vigentes × 1.000
  });
  it('con pendiente > 0 no aparece ese texto aunque haya descartes', () => {
    const c = montar(carcasa((p) => { p.lineaBase = lineaBase(); p.mejorasDescartadas = { [CLAVE_OP20]: descarte(12000) }; }));
    expect(c.queryByTestId('texto-barra')).toBeNull();
  });
  it('pendiente 0 sin descartes: sigue como hoy, sin texto', () => {
    const c = montar(tranquila((p) => { p.lineaBase = lineaBase({ costoPiezaBase: 0.02 }); }));
    expect(c.getByTestId('texto-logrado-pendiente').textContent).toContain('Pendiente ≈ USD 0/año');
    expect(c.queryByTestId('texto-barra')).toBeNull();
    expect(c.queryByTestId('descartado-anual')).toBeNull();
  });
});

describe('3. estado vacío de "Mejoras priorizadas"', () => {
  it('0 activas con 1 descartada y 0 implementadas: "Sin mejoras pendientes en esta pieza (1 descartada, 0 implementadas)" con enlace solo a descartadas', () => {
    const c = montar(tranquila((p) => { p.mejorasDescartadas = { 'Calidad|opq|': descarte(500) }; }));
    const texto = c.getByTestId('sin-mejoras-pendientes');
    expect(texto.textContent).toContain('Sin mejoras pendientes en esta pieza (1 descartada, 0 implementadas).');
    expect(within(texto).getByText('Ver mejoras descartadas')).toBeTruthy();
    expect(within(texto).queryByText('Ver mejoras realizadas')).toBeNull();
    expect(c.queryByText('Con los datos cargados no hay mejoras que superen los umbrales.')).toBeNull();
  });
  it('el enlace despliega "Mejoras descartadas"', () => {
    const c = montar(tranquila((p) => { p.mejorasDescartadas = { 'Calidad|opq|': descarte(500) }; }));
    const boton = within(c.getByTestId('mejoras-descartadas')).getByRole('button', { name: /Mejoras descartadas/ });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(within(c.getByTestId('sin-mejoras-pendientes')).getByText('Ver mejoras descartadas'));
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(c.getByTestId('mejora-descartada')).toBeTruthy();
  });
  it('con descartadas e implementadas: ambos conteos y ambos enlaces; el de realizadas despliega esa sección', () => {
    const c = montar(tranquila((p) => {
      p.mejorasDescartadas = { 'Calidad|opq|': descarte(500), 'Calidad|opx|': descarte(300) };
      p.implementaciones = [implementacion({ opId: 'opq', claveMejora: 'Productividad|opq|' })];
    }));
    const texto = c.getByTestId('sin-mejoras-pendientes');
    expect(texto.textContent).toContain('Sin mejoras pendientes en esta pieza (2 descartadas, 1 implementada).');
    fireEvent.click(within(texto).getByText('Ver mejoras realizadas'));
    expect(within(c.getByTestId('mejoras-realizadas')).getByRole('button', { name: /Mejoras realizadas/ }).getAttribute('aria-expanded')).toBe('true');
  });
  it('con las 10 de CAR-001 descartadas y 1 implementada', () => {
    const c = montar(carcasa((p) => { p.mejorasDescartadas = todasDescartadas(); p.implementaciones = [implementacion()]; }));
    expect(c.getByTestId('sin-mejoras-pendientes').textContent).toContain('Sin mejoras pendientes en esta pieza (10 descartadas, 1 implementada).');
  });
});

describe('4. diálogo de implementar: orientación y salida a Descartar', () => {
  it('muestra "¿No se puede aplicar? Usá Descartar y dejá el motivo." y el botón abre el diálogo de Descartar con la MISMA mejora', () => {
    const c = montar();
    fireEvent.click(botonImplementada(c, 1)); // la segunda mejora de la lista: Herramienta de Op30 (Broca Ø8,5)
    const dlg = dialogo('dialogo-implementada');
    expect(within(dlg).getByTestId('orientacion-descartar').textContent).toContain('¿No se puede aplicar? Usá Descartar y dejá el motivo.');
    const titulo = c.getAllByTestId('mejora')[1].querySelector('p.font-bold')!.textContent!;
    fireEvent.click(within(dlg).getByTestId('descartar-esta-mejora'));
    expect(within(document.body).queryByTestId('dialogo-implementada')).toBeNull(); // se cerró
    const descartar = dialogo('dialogo-descartar');
    expect(descartar.textContent).toContain(titulo);
    expect(descartar.textContent).toContain('Herramienta');
    // al confirmar, descarta esa mejora y no otra
    fireEvent.change(within(descartar).getByLabelText('Motivo (obligatorio)'), { target: { value: 'No se puede cambiar la broca' } });
    fireEvent.click(within(descartar).getByTestId('confirmar-descarte'));
    expect(c.getByTestId('mejoras-descartadas').textContent).toContain('Mejoras descartadas (1)');
    expect(c.getByTestId('potencial').textContent).toContain('9 mejoras en esta pieza');
    expect(c.getAllByTestId('mejora')[0].textContent).toContain('Productividad'); // la de Op20 sigue activa
  });
});

describe('5. registros repetidos', () => {
  const repetida = () => carcasa((p) => { p.implementaciones = [implementacion({ costoPiezaAntes: COSTO_BASE, registradaEn: '2026-10-20T15:00:00.000Z' })]; });
  it('misma mejora y mismo costo por pieza a 4 decimales: avisa con la fecha y exige "Registrar igual" (no bloquea)', () => {
    const c = montar(repetida());
    fireEvent.click(botonImplementada(c, 0));
    const dlg = dialogo('dialogo-implementada');
    expect(within(dlg).getByTestId('aviso-repetida').textContent).toContain(`Ya registraste esta mejora el ${fechaLocal(new Date('2026-10-20T15:00:00.000Z'))} y el costo no cambió desde entonces.`);
    fireEvent.change(within(dlg).getByLabelText('Qué se cambió (obligatorio)'), { target: { value: 'Otro intento igual' } });
    fireEvent.click(within(dlg).getByTestId('confirmar-implementada'));
    expect(within(dlg).getByTestId('error-repetida').textContent).toBe('Marcá «Registrar igual» para continuar.');
    fireEvent.click(within(dlg).getByText('Cancelar')); // al cerrar el diálogo (con el modal abierto el resto de la pantalla queda oculto para los lectores)
    expect(within(c.getByTestId('mejoras-realizadas')).getByRole('button', { name: /Mejoras realizadas \(1\)/ })).toBeTruthy(); // sigue habiendo 1: no se registró
  });
  it('con la casilla "Registrar igual" marcada se registra (queda "Mejoras realizadas (2)")', () => {
    const c = montar(repetida());
    fireEvent.click(botonImplementada(c, 0));
    const dlg = dialogo('dialogo-implementada');
    fireEvent.change(within(dlg).getByLabelText('Qué se cambió (obligatorio)'), { target: { value: 'Otro intento igual' } });
    fireEvent.click(within(dlg).getByLabelText('Registrar igual'));
    fireEvent.click(within(dlg).getByTestId('confirmar-implementada'));
    expect(within(c.getByTestId('mejoras-realizadas')).getByRole('button', { name: /Mejoras realizadas \(2\)/ })).toBeTruthy();
  });
  it('mismo registro previo pero el costo cambió (antes 9,0000 ≠ ahora 9,3570): no avisa', () => {
    const c = montar(carcasa((p) => { p.implementaciones = [implementacion({ costoPiezaAntes: 9 })]; }));
    fireEvent.click(botonImplementada(c, 0));
    expect(within(dialogo('dialogo-implementada')).queryByTestId('aviso-repetida')).toBeNull();
  });
  it('misma mejora, costo igual solo hasta el 5.º decimal (9,35704 vs 9,3570235 → ambos 9,3570): sí avisa; 9,3571 no', () => {
    const c1 = montar(carcasa((p) => { p.implementaciones = [implementacion({ costoPiezaAntes: 9.35704 })]; }));
    fireEvent.click(botonImplementada(c1, 0));
    expect(within(dialogo('dialogo-implementada')).getByTestId('aviso-repetida')).toBeTruthy();
    cleanup();
    const c2 = montar(carcasa((p) => { p.implementaciones = [implementacion({ costoPiezaAntes: 9.3571 })]; }));
    fireEvent.click(botonImplementada(c2, 0));
    expect(within(dialogo('dialogo-implementada')).queryByTestId('aviso-repetida')).toBeNull();
  });
  it('otra mejora (otra clave) con el mismo costo: no avisa', () => {
    const c = montar(repetida());
    fireEvent.click(botonImplementada(c, 1));
    expect(within(dialogo('dialogo-implementada')).queryByTestId('aviso-repetida')).toBeNull();
  });
});

describe('6. botones diferenciados', () => {
  it('"Descartar" va aparte (a la derecha) y con otro estilo que "Comparar alternativa" y "Marcar como implementada"', () => {
    const c = montar();
    const tarjeta = within(c.getAllByTestId('mejora')[0]);
    const descartar = tarjeta.getByText('Descartar');
    const marcar = tarjeta.getByText('Marcar como implementada');
    const comparar = tarjeta.getByText('Comparar alternativa');
    expect(descartar.className).toContain('ml-auto');
    expect(descartar.className).toContain('text-red-700');
    expect(marcar.className).not.toContain('ml-auto');
    expect(marcar.className).not.toContain('text-red-700');
    expect(comparar.className).not.toContain('text-red-700');
    expect(descartar.className).not.toContain('dark:');
  });
});
