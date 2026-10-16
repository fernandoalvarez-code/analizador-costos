# Pendientes conocidos

## Edición de la curva de costos: horas por turno y turnos por día fijos en 8 × 1

**Dónde:** `src/app/(app)/taylor-curve/[id]/edit/page.tsx` (la llamada a `useTaylorCurve` y las props de `PdfPaginaDashboard`
fijan `horasPorTurno: 8` y `turnosPorDia: 1`).

**Qué pasa:** la pantalla nueva (`taylor-curve/page.tsx`) deja cargar Hrs/Trn y Trns/Día y los guarda en `taylorInputs`, pero la
edición no tiene esos campos, no los restaura y calcula todo con 8 × 1. Para un caso guardado con otros turnos, la edición muestra
horas por máquina / "≈ N máq." / "Pzas / Trn" distintos de los del informe original, y el PDF regenerado desde la edición también.

**Ya resuelto (feat/maquinas-escala):** al guardar desde la edición ya no se pierden `horasPorTurno` ni `turnosPorDia` (antes
`updateDoc` los borraba de `taylorInputs`). El bloque nuevo de "Máquinas en paralelo" usa los valores guardados.

**Falta (tarea aparte):** agregar los campos Hrs/Trn y Trns/Día a la edición, restaurarlos y usarlos en TODOS los cálculos de la
pantalla y del PDF. Cambia los números de la edición para los casos guardados con turnos distintos de 1: conviene avisar y verificarlo
con un PDF real antes de publicarlo.

## Días de trabajo por mes

`capacityCheck` (en `use-taylor-curve.ts`) sigue usando 22 días fijos para sus líneas de siempre. El campo "Días de trabajo por mes"
(feat/maquinas-escala) solo afecta al bloque de máquinas en paralelo, por decisión de producto.
