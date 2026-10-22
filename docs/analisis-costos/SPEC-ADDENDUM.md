# ADDENDUM v1.1 al SPEC (prevalece sobre SPEC.md)

Los puntos están numerados porque los prompts de implementación citan "punto N".

1. **Roles y tenant.** `role` sigue siendo `'user' | 'admin'` (no se tocan `users-roles.ts` ni sus tests). `admin_secocut` = `role == 'admin'`. Cliente = `role 'user'` + `users/{uid}.empresaId`. Vendedor = email `@secocut.com` verificado + `users/{uid}.empresasAsignadas`. `empresaId` y `empresasAsignadas` los escribe SOLO el servidor (Admin SDK). `'operario'` queda fuera (fase futura).

2. **Reglas editables:** `settings/reglasCostos` (no `config/...`). Lectura: usuario verificado; escritura: admin. Umbrales globales, no por empresa. Al guardarlas, escribir `updatedAt` con `serverTimestamp`. Si el documento no existe, se usan los defaults del código con `reglasVersion = 0`.

3. **Nomenclatura.** "Oportunidad" se reemplaza por "Mejora": tipo `MejoraCosto`, archivo `mejoras.ts`, campos `cantMejoras` y `ahorroPotencialAnual`; UI "Mejoras priorizadas" y "Ahorro potencial". Menú: "Costos de mecanizado". Título del módulo: "Análisis de costos de mecanizado".

4. **Unidades de resumen** (por pieza, no por año; la planta multiplica por `volumenAnual`): `costoPieza` (USD/pza, SIN material), `costoAnual` (= `costoPieza × volumenAnual`), `minutosPieza`, `opMayorCosto`, `rubroPrincipal`, `porRubroUsdPza`, `porMaquinaUsdPza`, `maquinaIds: string[]`, `ahorroPotencialAnual`, `cantMejoras`, `calcVersion`, `reglasVersion`. El costo de mecanizado no incluye el material, salvo su efecto en el scrap acumulado. El KPI "pieza con material" = `costoPieza + materialEf`.

5. **Mínimos obligatorios** (en `calc.ts` y como validación en formularios, con mensaje visible): piezas por filo ≥ 0,01; insertos por herramienta ≥ 1; filos por inserto ≥ 1; lote efectivo ≥ 1; volumen anual ≥ 1; precios, tiempos y costo hora ≥ 0; porcentajes (scrap, rotura) entre 0 y 100.

6. **Avisos no bloqueantes:** vida útil por filo < 5 min o > 90 min → "verificar el dato". Aviso de lote (< 50 piezas o > 2.000 preparaciones por año), como en el SPEC.

7. **Regla "Herramienta":** se evalúa por herramienta: (consumo + cambios de esa herramienta) / `totalOp` > 18 %.

8. **Resumen desactualizado:** si cambia `costoHora` de una máquina → recalcular en lote el resumen de las piezas con esa máquina (`maquinaIds` con `array-contains`), en tandas de 100. "No eliminar máquina en uso" → consulta `maquinaIds array-contains` con límite 1. Si `reglasVersion` de una pieza ≠ la versión actual de `settings/reglasCostos` → insignia "calculado con reglas anteriores" y botón admin "Recalcular resúmenes" (idempotente y reanudable: completa solo las piezas desactualizadas e informa cuántas se recalcularon y cuántas fallaron).

9. **Nombres de campos:** los largos del SPEC son la fuente de verdad. El prototipo usa claves cortas solo como referencia. El generador de 98 piezas se escribe en formato SPEC.

10. **Sensibilidad "subir vc 10 %":** se muestra con "sube" o "baja" explícito (positivo = el costo sube).
