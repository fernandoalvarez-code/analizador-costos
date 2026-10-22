# Módulo "Análisis de costos de mecanizado" — Especificación

App: **analizador-costos** (Next.js 14 App Router · TypeScript · Firebase Firestore · Tailwind · Recharts).
Prototipo de referencia visual y funcional: `docs/prototipos/analisis-costos-mecanizado.html` (abrirlo en el navegador; toda la lógica está en el `<script>`).

---

## 1. Objetivo

Que **cada cliente** detecte **dónde está su mayor costo de mecanizado por pieza** (por operación, por rubro y por herramienta) y pueda **decidir entre herramientas alternativas** con datos en USD.

Principios:
- Lo primero que se ve siempre es **plata (USD por pieza y USD por año)**; los % son información secundaria.
- Carga **manual** simple, con los datos que se miden en planta.
- Escala a clientes con **100+ piezas**.
- No se toca el módulo existente `taylor-curve` ni el módulo `Oportunidades`.

---

## 2. Navegación

| Ruta | Pantalla |
|---|---|
| `/costos` | **Resumen de planta** (pantalla de entrada) |
| `/costos/piezas/[piezaId]` | **Análisis por pieza**, con dos sub-pestañas: *Diagnóstico* (default) y *Cargar / editar datos* |
| `/costos/maquinas` | **Mis máquinas** y su costo hora |

Encabezado del módulo: **"Análisis de costos de mecanizado"**, subtítulo "Diagnóstico de costo por pieza y por operación · SECOCUT", y a la derecha la empresa y planta del usuario.

---

## 3. Modelo de datos (Firestore, multiempresa)

```
empresas/{empresaId}
  nombre, plantas: string[], vendedorId, createdAt

empresas/{empresaId}/maquinas/{maquinaId}
  nombre: string            // "Centro vertical 1"
  costoHora: number         // USD/h (incluye operario, energía, amortización, gastos)
  planta?: string

empresas/{empresaId}/piezas/{piezaId}
  codigo: string, nombre: string
  volumenAnual: number                 // piezas por año
  modoProduccion: 'lote' | 'lotesAnio' | 'dedicada'
  piezasPorLote?: number               // si modo = 'lote'
  lotesPorAnio?: number                // si modo = 'lotesAnio'
  material: {
    quienPone: 'propio' | 'cliente',
    costoPorPieza?: number,            // si 'propio'
    clienteCobraScrap?: boolean,       // si 'cliente'
    cobroPorPiezaPerdida?: number      // si 'cliente' y cobra
  }
  operaciones: Operacion[]             // embebidas, en orden de la ruta
  resumen: {                           // DESNORMALIZADO: se recalcula al guardar (para el listado de 100+ piezas)
    costoPieza, costoAnual, minutosPieza, opMayorCosto, rubroPrincipal,
    ahorroPotencial, cantOportunidades, porRubro: Record<Rubro, number>,
    porMaquina: Record<maquinaId, number>   // USD/año por máquina
  }
  createdAt, updatedAt, updatedBy

Operacion {
  id, nombre, maquinaId,
  tiemposMuertosMin: number   // por pieza (carga, descarga, posicionamiento, medición)
  setupMin: number            // por lote
  scrapPct: number
  herramientas: PosicionHerramienta[]
}

PosicionHerramienta {
  id,
  seleccionada: number        // índice de la opción EN USO
  opciones: OpcionHerramienta[]   // la en uso + alternativas para comparar
}

OpcionHerramienta {
  id, nombre,
  precio: number              // USD por inserto o por herramienta enteriza
  insertosPorHerramienta: number
  filosPorInserto: number     // 1 si es enteriza
  piezasPorFilo: number       // DATO MEDIDO en planta
  cortePorPiezaMin: number    // tiempo de corte de ESTA herramienta en la pieza
  cambioMin: number           // máquina parada por cambio/indexado normal
  roturaPct?: number          // % de los cambios que son por rotura
  roturaExtraMin?: number     // tiempo extra por rotura
  roturaScrapPct?: number     // % de roturas que tiran la pieza
}

users/{uid}
  empresaId, rol: 'admin_cliente' | 'operario' | 'vendedor' | 'admin_secocut'
  empresasAsignadas?: string[]   // vendedor

config/reglasCostos
  umbrales y supuestos de ahorro de la sección 6 (editables sin redeploy)
```

**Unidades:** todos los tiempos se guardan en **minutos (decimal)**. En la UI se muestran y cargan en **mm:ss**.

---

## 4. Motor de cálculo (`src/lib/costos-mecanizado/calc.ts` — funciones puras)

Notación: `h = costoHora / 60` (USD por minuto) de la máquina de la operación.

### 4.1 Lote efectivo y material
```
loteEf = modo 'dedicada'  → volumenAnual
         modo 'lotesAnio' → volumenAnual / lotesPorAnio
         modo 'lote'      → piezasPorLote            (mínimo 1)

materialEf = quienPone 'propio'  → costoPorPieza
             quienPone 'cliente' → clienteCobraScrap ? cobroPorPiezaPerdida : 0
```

### 4.2 Por herramienta (solo la opción EN USO entra en la cuenta)
```
pf      = piezasPorFilo
corte   = cortePorPiezaMin × h
consumo = insertosPorHerramienta × precio / (pf × filosPorInserto)
cambios = cambioMin × h / pf
rq      = roturaPct/100 / pf                     // roturas por pieza
rotTiempo = rq × roturaExtraMin × h              // suma al rubro "cambios"
perdida   = rq × roturaScrapPct/100              // fracción de piezas perdidas por rotura
vidaUtilFilo (min) = pf × cortePorPiezaMin       // calculada; editable en UI → recalcula pf = vida / corte
```

### 4.3 Por operación (en orden de la ruta)
```
acumulado inicia en materialEf
corte     = Σ corte(herramientas)
aux       = tiemposMuertosMin × h
setup     = setupMin / loteEf × h
herr      = Σ consumo
camb      = Σ (cambios + rotTiempo)
antes     = corte + aux + setup + herr + camb
acumulado += antes                       // valor de la pieza al terminar la op
scrapRot_i = perdida_i × acumulado       // por herramienta
scrap     = scrapPct/100 × acumulado + Σ scrapRot_i
acumulado += scrap
totalOp   = antes + scrap
minutosOp = Σ cortePorPiezaMin + tiemposMuertosMin + setupMin/loteEf
```
**6 rubros:** Tiempo de corte · Tiempos muertos · Preparación · Herramientas (consumo) · Cambios de herr. (incluye tiempo de roturas) · Scrap (incluye piezas perdidas por rotura).

### 4.4 Por pieza y planta
```
costoPieza = Σ totalOp ;  costoAnual = costoPieza × volumenAnual
opMayorCosto = op con mayor totalOp ; rubroPrincipal = rubro con mayor suma
Planta: sumar costoAnual, porRubro×vol, porMaquina×vol de todas las piezas
Pareto: cuántas piezas (ordenadas desc por costoAnual) llegan al 80%
```

### 4.5 Incidencia por herramienta (tabla dentro de la operación)
```
costoHerr     = corte + consumo + cambios + rotTiempo + scrapRot   ← COLUMNA PRINCIPAL (USD/pza)
partPieza     = costoHerr / costoPieza
partOp        = costoHerr / totalOp
sensPrecio    = (consumo + cambios) / totalOp  → Bajo < 5% · Medio 5–15% · Alto > 15%
   (mide cuánto se nota el precio, NO cuánto cuesta; tooltip explicativo obligatorio)
```
Sensibilidad (en % del costo de la pieza):
```
Precio +10%                         = 0,10 × consumo / costoPieza
Vida +10%                           = (1 − 1/1,1) × (consumo + cambios) / costoPieza       (baja)
Corta 10% más rápido, misma vida(min)= (1 − 1/1,1) × (corte + consumo + cambios) / costoPieza (baja)
Subir vc 10% misma herr. (Taylor n=0,25 → vida ×0,683)
                                    = (0,4641 × (consumo + cambios) − (1 − 1/1,1) × corte) / costoPieza
```

### 4.6 Comparación entre opciones de una posición
```
costoOpcion(a) = corte + consumo + cambios + rotTiempo + perdida × acumuladoOp
delta          = costoOpcion(a) − costoOpcion(enUso)      → por pieza y × volumenAnual
precioMaximo(a)= (costoOpcion(enUso) − (costoOpcion(a) − consumo(a))) × pf × filos / insertos
                 (precio al que la opción empata; si ≤ 0 → "no empata")
```

### 4.7 Valores de control (deben dar igual que el prototipo)
Máquinas: Torno CNC 1 = 30 · Centro vertical 1 = 35 · Centro vertical 2 = 35 · Centro horizontal = 45 USD/h.
Pieza **CAR-001 Carcasa**: 25.000 pzs/año · lote 500 · material propio USD 9,50.

| Op | Máquina | Muertos | Setup | Scrap | Herramientas en uso (precio, insertos, filos, pzs/filo, corte min, cambio min) |
|---|---|---|---|---|---|
| 10 Planeado 2 caras | CV2 | 0,6 | 45 | 0,3% | Fresa planear: 25, 8, 9, 60, 0,8, 6 |
| 20 Desbaste y contorno | CH | 1,0 | 60 | 0,5% | Alto avance: 20, 4, 4, 85, 2,4, 6 · Enteriza Ø12: 50, 1, 1, 180, 0,8, 4 |
| 30 Agujereado | CV1 | 0,5 | 30 | 1,2% | Broca Ø8,5: 180, 1, 1, 180, 0,45, 5 · Broca inserto Ø25: 25, 2, 2, 950, 0,15, 4 |
| 40 Roscado M10 | CV1 | 0,3 | 20 | 1,0% | Macho: 75, 1, 1, 150, 0,5, 4 |
| 50 Torneado alojamiento | T1 | 0,7 | 40 | 0,3% | CNMG: 10, 1, 4, 105, 1,1, 2 |

Resultados esperados (USD/pza): Op10 **1,3303** · Op20 **3,8959** · Op30 **1,9190** · Op40 **1,1821** · Op50 **1,0297** · **Pieza 9,3570** · **Anual 233.926**.
Op30 desglose: corte 0,35 · aux 0,2917 · setup 0,035 · herr 1,0263 · camb 0,0187 · scrap 0,1974.
Alternativa en Op30 "Broca refrig. interna + mandril" (200, 1, 1, 510, 0,36, 5): **delta −0,671 USD/pza = −USD 16.771/año**, precio máximo **USD 542,12**.

---

## 5. UI por pantalla (ver prototipo)

### 5.1 Resumen de planta (`/costos`)
1. KPIs: piezas analizadas · costo anual de mecanizado · % herramientas en el mecanizado · ahorro potencial estimado.
2. Recuadro "Dónde está tu mayor costo" (3 líneas): N de M piezas = 80% · pieza más cara del año · máquina con más costo y rubro principal.
3. Top 10 piezas por costo anual (barras apiladas por rubro, % acumulado). Clic → abre la pieza.
4. Costo anual por máquina y por rubro.
5. Tabla de todas las piezas: búsqueda, filtro por máquina y por rubro principal, orden por columna, **15 por página**, botón "+ Nueva pieza". Usa `resumen` desnormalizado (no recalcula 100 piezas en el cliente).

### 5.2 Pieza — Cargar / editar datos
- Barra superior: nombre de la pieza, costo/pza, anual; buscador para cambiar de pieza; "Duplicar"; "← Resumen de planta".
- **A. Datos de la pieza:** código y nombre · piezas por año · ¿quién pone el material? (Yo → costo por pieza / El cliente → ¿te cobra las piezas perdidas? → monto).
- **Modo de producción** (3 tarjetas): por lotes (piezas por lote) · por lotes (lotes por año) · máquina dedicada. Debajo: "= N preparaciones por año · lotes de X piezas". Aviso amarillo si lote < 50 o > 2.000 preparaciones/año.
- **B. Ruta de operaciones:** tabla (Op · Operación · Máquina · Tiempo/pza mm:ss · USD/pza · % pieza · Editar). La op de mayor costo con el número en rojo. Clic → se despliega el editor:
  - Barra de incidencia de la operación (6 rubros) + texto "Esta operación cuesta USD X por pieza = Y% de la pieza…".
  - **Cambio desde que abriste la operación** (verde/rojo, USD/pza y USD/año) + botón "Fijar como nueva base".
  - Tiempos y calidad: tiempo de corte (suma, solo lectura, mm:ss) · tiempos muertos (mm:ss) · setup por lote (mm:ss) · scrap %.
  - **Herramientas:** una caja por posición con tabla de opciones: radio En uso · Opción · Precio · Insertos/herr. · Filos/inserto · Piezas por filo · Corte por pieza (mm:ss) · Vida útil por filo (= piezas × corte, editable) · Cambio (mm:ss) · Roturas (botón que despliega 3 campos) · USD/pza · vs. en uso (USD/pza y USD/año) · Precio máx. · ✕. Botones "+ Opción" y "+ Herramienta".
  - **Incidencia de cada herramienta:** Costo USD/pza (principal) · Cambio al editar · Tiempo de corte · Consumo · Cambios · Roturas · participaciones y sensibilidad al precio (en gris, con "?").
  - Línea de sensibilidad por herramienta (4 escenarios de 4.5).
- **Entrada de tiempos mm:ss:** "1:30" = 1 min 30 s; "0:27" = 27 s; número sin ":" = minutos. Al salir del campo se reescribe en mm:ss.
- Recalcula en vivo mientras se escribe (sin re-render que pierda el foco). Guardado con debounce o botón "Guardar".

### 5.3 Pieza — Diagnóstico
1. Recuadro rojo "Mayor costo de esta pieza": op, % del mecanizado, USD/pza, USD/año, rubro que más pesa dentro de la op y en la pieza.
2. KPIs: mecanizado/pza (+ min:seg) · pieza con material (o "Material: lo pone el cliente") · anual · % herramientas.
3. ¿Dónde está el costo? (ops desc, barras apiladas) | ¿En qué se va? (rubros desc).
4. Matriz op × rubro (USD/pza, celdas sombreadas por intensidad, totales).
5. Oportunidades priorizadas (top 5 + "ver todas"), con potencial total.

### 5.4 Mis máquinas
Tabla editable nombre + costo hora; agregar/eliminar (no eliminar si está en uso).

---

## 6. Reglas de oportunidades (`rules.ts`, umbrales en `config/reglasCostos`)

| Regla | Condición | Ahorro estimado (supuesto) | Botón comparar |
|---|---|---|---|
| Productividad | corte / totalOp > 45% | 20% del corte | Sí |
| Tiempos muertos | muertos > 60% del corte y aux > 0,05 | 30% de aux | No |
| Preparación | setup / totalOp > 12% | 40% del setup | No |
| Herramienta | (consumo+cambios)/totalOp > 18% | 35% de consumo+cambios | Sí |
| Calidad | scrap / totalOp > 8% | 50% del scrap | No |
| Roturas | costo roturas herr. / totalOp > 5% | 60% del costo de roturas | Sí |

Texto de cada oportunidad: categoría · op · título · explicación con números · supuesto. Ordenadas por USD/año. Siempre aclarar "supuestos conservadores, a confirmar con ensayo en planta".

---

## 7. Permisos y seguridad (OBLIGATORIO antes de cargar datos reales)
- Cada usuario lee/escribe **solo** `empresas/{suEmpresaId}/**`. Vendedor: solo `empresasAsignadas`. `admin_secocut`: todo.
- El rol y la empresa **no** pueden ser escritos por el propio usuario (evitar auto-asignación de admin).
- Operario: no ve costos (fase futura: formulario QR).
- Los datos de costos de un cliente nunca son visibles para otro cliente.

---

## 8. Fuera de alcance de esta versión (fases futuras)
Importación de rutas desde Excel · registro de vida por QR del operario · comparador A/B independiente · PDF con formato SECOCUT · vista interna SECOCUT de margen sugerido por herramienta (peso + validación + precio máximo) · reafilado y amortización de portaherramientas · separar costo hora fijo/variable y máquina saturada.
