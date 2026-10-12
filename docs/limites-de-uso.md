# Límites de uso de las rutas de IA

Las rutas `/api` que gastan cuota de IA limitan cuántas veces puede llamarlas cada usuario por día,
y tienen además un tope global por ruta que actúa como cortacircuitos.

**Los valores actuales son PROVISORIOS**: salieron de una estimación inicial y hay que revisarlos
con el uso real.

| Ruta | Por usuario / día | Global / día |
|---|---|---|
| `/api/chat` | 40 | 300 |
| `/api/agents/chat` | 40 | 300 |
| `/api/suggest-cutting-data` | 40 | 300 |
| `/api/savings-suggestions` | 20 | 300 |

## Dónde se cambian
Variables **no secretas** en [apphosting.yaml](../apphosting.yaml):
`RATE_LIMIT_<RUTA>_USER_DAILY` y `RATE_LIMIT_<RUTA>_GLOBAL_DAILY`, con `<RUTA>` = `CHAT`, `AGENTS_CHAT`,
`SUGGEST_CUTTING_DATA` o `SAVINGS_SUGGESTIONS`. Cambiarlas requiere volver a desplegar. Un `0` bloquea la
ruta (sirve como interruptor de emergencia). Si una variable falta o no es un entero ≥ 0 se usa el valor por
defecto del código ([rate-limit.ts](../src/lib/server/rate-limit.ts)).

## Cómo funciona
- El día es UTC: se renueva a las **21:00 de Argentina**.
- Cada request consume un cupo del usuario y uno global, de forma atómica (transacción de Firestore con el
  Admin SDK). Se cuenta el intento aunque después la IA falle.
- Superado el límite: **429** con un mensaje claro y el header `Retry-After`.
- **Falla cerrado**: si el contador no responde, la ruta contesta **503** y no llama a la IA.
- Los contadores viven en la colección `rate_limits` (`<ruta>__<uid>__<día>` y `<ruta>__GLOBAL__<día>`).
  Las reglas de Firestore la cierran por completo a los clientes.

## Pendiente
- **Limpieza de contadores viejos.** Cada documento guarda `expireAt` (3 días). Falta crear una política TTL
  de Firestore sobre `rate_limits.expireAt` (consola de Firebase → Firestore → TTL). Hasta entonces los
  documentos se acumulan: uno por usuario, ruta y día, un volumen bajo.
- Revisar los límites con el consumo real después de las primeras semanas.
