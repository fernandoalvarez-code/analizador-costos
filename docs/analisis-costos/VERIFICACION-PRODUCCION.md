# Verificación en producción antes de dar acceso a clientes

El emulador de Firestore **puede no reproducir exactamente los límites de producción** (lecturas de reglas por escritura, tiempos,
cuotas). Por eso, antes de dar acceso a cualquier cliente real hay que verificar en producción, con una empresa de prueba y
cuentas de prueba (nunca datos de clientes):

1. **Recálculo en lote.** Cargar 100 piezas (y probar también con más de 200) que usen una misma máquina y cambiar su costo hora.
   El recálculo escribe en tandas de 100 piezas con `writeBatch` (`TAMANO_TANDA` en `src/lib/costos-mecanizado/firestore.ts`).
   Cada escritura del lote evalúa las reglas de `empresas/{empresaId}/piezas/{id}`, que leen `users/{uid}` (`exists()` + `get()`;
   Firestore cachea el mismo documento dentro de la solicitud). En el emulador pasan tandas de 100 y también de 400. Si en producción
   una tanda de 100 falla por el límite de lecturas de reglas, el plan es mover el recálculo a una ruta del servidor con Admin SDK
   (las reglas no aplican) o bajar `TAMANO_TANDA`.
2. **Aislamiento entre dos empresas** con cuentas reales de prueba: cada una ve solo lo suyo, y un usuario con el email sin verificar
   no entra.
3. **Reglas publicadas.** `firestore.rules` se publica a mano desde la consola de Firebase; hasta entonces producción sigue con las
   reglas anteriores y el módulo no debe usarse con datos reales.

Resultado del emulador (feat/costos-datos): batch de 100 piezas (edición y creación) y de 400 (informativo) **pasan**; `test:rules`
cubre además el recálculo real de 250 piezas (tres tandas) a través de la capa de datos.
