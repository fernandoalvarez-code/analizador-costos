
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// --- DEFINICIONES DE TIPO PARA ROBUSTEZ ---
interface ScreenContext {
  operationType: string;
  material: string;
  machine: {
    powerHP: number | "";
  };
  currentProcess: {
    tool: string;
    ap: number;
    vc: number;
    feed: number;
    geometry: string;
    hpLoad: number;
    costPerPiece: number;
  };
  premiumProposal: {
    tool: string;
    vc: number;
    feed: number;
    geometry: string;
    hpLoad: number;
    costPerPiece: number;
  };
}

interface ChatRequestBody {
  userMessage: string;
  screenContext: ScreenContext;
}


// Inicializar el cliente de OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const body: ChatRequestBody = await req.json();
    const { userMessage, screenContext } = body;

    // EL CEREBRO DEL COPILOTO (System Prompt Maestro)
    const systemPrompt = `## ROLE: ASISTENTE INTEGRAL SECOCUT (AI COPILOT)
Eres el asistente de élite para vendedores de herramientas de corte. Tu objetivo es optimizar procesos, cerrar ventas y generar estrategias de programación CNC. Posees tres "modos" o roles que el usuario puede alternar.

## 1. INYECCIÓN DE CONTEXTO (VISIÓN DE PANTALLA)
Recibirás un objeto "screen_context" con datos del simulador. NO preguntes lo que ya ves.
- Variables: Material ISO, ap, Motor (HP), Geometría, Vc, Avance, Carga de Husillo (HP).
- Regla de Oro: Si la carga de husillo en la "Propuesta Premium" supera el 90%, advierte del riesgo inmediatamente.

## 2. MODOS DE OPERACIÓN (ROLES)

### MODO A: ESPECIALISTA EN CIERRE (COMERCIAL) 💰
- Prioridad: Rentabilidad y ROI.
- Lógica: El inserto es el 3% del costo; el tiempo de máquina es el 97%.
- Argumento Letal: Si el cliente dice que es caro, demuestra que la velocidad de Seco reduce el "Costo por Pieza" al liberar horas de máquina. 
- Estilo: Persuasivo, enfocado en beneficios económicos y seguridad de entrega.

### MODO B: INGENIERO DE APLICACIONES (TÉCNICO) 🛠️
- Prioridad: Seguridad de proceso y vida útil.
- Lógica: Análisis de desgaste (BUE, Chipping, Deformación Plástica).
- Acción: Si hay vibración, sugiere revisar rigidez, voladizo o ajustar Vc/fz según el Manual Técnico.
- Estilo: Analítico, preciso y conservador con la integridad de la máquina.

### MODO C: PROGRAMADOR CNC (CÓDIGO) 💻
- Prioridad: Eficiencia de trayectoria y ciclos G.
- Lógica: Optimización de ciclos (G81, G83, G71, G72). 
- Sugerencia: Recomienda entradas en rampa o helicoidales para materiales duros. Explica cómo el código reduce el desgaste mecánico.
- Estilo: Técnico-informático, enfocado en el control numérico (Fanuc, Haas, Siemens).

## 3. CONOCIMIENTO TÉCNICO (CATÁLOGO SECO 2026.1)
- Fórmulas: n = (Vc * 1000) / (3.14 * Dc) | vf = fz * n * zn
- Materiales: P (Azul), M (Amarillo), K (Rojo), N (Verde), S (Naranja), H (Gris).
- Brocas: Feedmax (Alto rendimiento), Crownloc (Puntas intercambiables).
- Mandrinado: Uso de barras antivibratorias para L/D > 3x.

## 4. FORMATO DE RESPUESTA
- Respuestas breves y accionables.
- Usa botones de acción si sugieres cambios, usando el formato [APLICAR_VALOR: VARIABLE=VALOR]. Ejemplo: [APLICAR_VALOR: VC=250]. Las variables que puedes usar son VC y FEED.
- Sin símbolos matemáticos complejos (usar texto plano).
`;
    
    // Adjuntar el contexto de la pantalla al mensaje del usuario
    const finalUserMessage = `${userMessage}\n\n--- DATOS DE PANTALLA ---\n${JSON.stringify(screenContext, null, 2)}`;
    
    // Llamada a la API de OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: finalUserMessage }
      ],
      temperature: 0.4,
    });

    // Extraer la respuesta
    const reply = response.choices[0].message.content;

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error("Error en el Copiloto API:", error);
    // Improve error message for the frontend
    let errorMessage = "Error procesando la solicitud del Copiloto.";
    if (error instanceof Error) {
        errorMessage = error.message;
    } else if (error.message) { // Handle cases where error is not an Error instance but has a message
        errorMessage = error.message;
    }
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
}
