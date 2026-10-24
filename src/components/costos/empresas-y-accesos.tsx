"use client";

import React, { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AccesoClientes from './acceso-clientes';
import { EmpresaProvider, useEmpresa } from './empresa-context';
import NuevaEmpresa from './nueva-empresa';
import SelectorEmpresa from './selector-empresa';

export const ID_EMPRESAS_Y_ACCESOS = 'empresas-y-accesos';
const CLASE_AVISO = 'rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600';

function Contenido() {
  const { estado, mensajeError, empresa, recargar } = useEmpresa();

  // El enlace "Gestionar clientes" llega con #empresas-y-accesos: la sección aparece recién cuando carga el perfil, así que se desplaza acá.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === `#${ID_EMPRESAS_Y_ACCESOS}`) document.getElementById(ID_EMPRESAS_Y_ACCESOS)?.scrollIntoView?.({ block: 'start' });
  }, []);

  return (
    <Card id={ID_EMPRESAS_Y_ACCESOS} data-testid="empresas-y-accesos">
      <CardHeader>
        <CardTitle>Empresas y accesos (Costos de mecanizado)</CardTitle>
        <CardDescription>Creá empresas clientes, invitá a sus usuarios y asigná vendedores. Solo lo ve el administrador de SECOCUT.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {estado === 'cargando' && (
          <div role="status" data-testid="empresas-cargando" className={`${CLASE_AVISO} flex items-center gap-2`}>
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando empresas…
          </div>
        )}
        {estado === 'error' && (
          <div role="alert" data-testid="empresas-error" className={`${CLASE_AVISO} space-y-3`}>
            <p>{mensajeError}</p>
            <Button type="button" variant="outline" size="sm" onClick={recargar}>Reintentar</Button>
          </div>
        )}
        {(estado === 'listo' || estado === 'sin-empresas') && (
          <>
            <div className="flex flex-wrap items-end gap-4">
              <SelectorEmpresa mostrarEnlaceGestion={false} />
              <NuevaEmpresa />
            </div>
            {estado === 'sin-empresas' && <p className={CLASE_AVISO} data-testid="empresas-vacio">Todavía no hay empresas. Creá la primera con «+ Nueva empresa».</p>}
            {/* key: al cambiar de empresa se descarta todo el estado del panel de accesos */}
            {empresa && <AccesoClientes key={`acceso-${empresa.id}`} empresaId={empresa.id} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Administración de clientes del módulo de costos, dentro de Configuración. Trae su propio <EmpresaProvider>: la página de Configuración solo
 * lo monta para el admin SECOCUT, así que un usuario común, un vendedor o un cliente de empresa no disparan ninguna lectura de empresas desde ahí.
 */
export default function EmpresasYAccesos() {
  return (
    <EmpresaProvider>
      <Contenido />
    </EmpresaProvider>
  );
}
