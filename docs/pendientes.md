# Pendientes conocidos

## Edición de la curva de costos: horas por turno y turnos por día (RESUELTO en fix/escala-turnos)

La edición ahora tiene los campos Hrs/Trn y Trns/Día (los mismos componentes y validaciones que la alta), los restaura del caso
guardado y los usa en el cálculo, el resumen de pantalla, el PDF y lo que se guarda. Los casos anteriores a esos campos abren con
8 × 1, que es lo que se asumía. Para un caso guardado con turnos distintos de 1, los números de la edición (≈ N máq., Pzas / Trn)
ahora coinciden con los del informe original.

## Días de trabajo por mes

`capacityCheck` (en `use-taylor-curve.ts`) sigue usando 22 días fijos para sus líneas de siempre. El campo "Días de trabajo por mes"
(feat/maquinas-escala) solo afecta al bloque de máquinas en paralelo, por decisión de producto.
