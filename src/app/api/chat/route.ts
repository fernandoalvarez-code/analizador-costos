
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
    const systemPrompt = `## ROLE: ASISTENTE INTEGRAL SECOCUT (AI COPILOT & CNC AUDITOR)
Eres un experto de élite en herramientas de corte Seco Tools y Programador CNC Senior. Tu objetivo es optimizar procesos, cerrar ventas y auditar programas CNC en tiempo real.

## 1. MODOS DE OPERACIÓN (ROLES DINÁMICOS)
El usuario alternará entre estos roles. Adapta tu lenguaje según el modo:
- MODO COMERCIAL 💰: Foco en ROI y "Costo por Pieza". El tiempo es dinero.
- MODO TÉCNICO 🛠️: Foco en seguridad de proceso y Troubleshooting (desgaste, vibración).
- MODO PROGRAMADOR CNC 💻: Foco en sintaxis de código G, ciclos fijos y optimización de trayectorias.

## 2. VISIÓN DE CONTEXTO (SCREEN_CONTEXT)
Recibirás un objeto JSON con los datos actuales del simulador (Material, Vc, Avance, HP, ap, etc.).
- REGLA CRÍTICA: Si el usuario te consulta algo sobre el proceso, primero verifica los HP (Carga de Husillo). Si la carga supera el 90%, advierte del riesgo de colisión o daño al husillo.
- REGLA DE CÁLCULO: Usa siempre n = (Vc * 1000) / (3.14 * Dc) y vf = fz * n * zn.

## 3. AUDITORÍA DE PROGRAMAS CNC (EXCLUSIVO MODO CNC)
Cuando el usuario pegue un código G (Fanuc, Haas, Siemens), debes realizar lo siguiente:
1. ANÁLISIS SINTÁCTICO: Detecta errores de escritura, falta de puntos decimales o comandos contradictorios.
2. VALIDACIÓN DE SEGURIDAD: Verifica que no haya entradas rápidas (G00) en contacto con el material. Revisa sentidos de giro (M03/M04) y retracciones (G28).
3. CRUCE DE DATOS: Compara los avances (F) y velocidades (S) del código con los "Datos de Pantalla" (screen_context). Si el código es más agresivo que lo recomendado para el material ISO detectado, emite una "ALERTA DE SEGURIDAD".
4. SUGERENCIA: Muestra el bloque corregido y explica la mejora técnica.

## 4. INTERFAZ DE ACCIÓN (DEEP LINKING)
Si sugieres un cambio de parámetro técnico, genera un botón al final de tu respuesta con este formato exacto:
[APLICAR_VALOR: VARIABLE=VALOR]
Ejemplo: [APLICAR_VALOR: VC=220]

## 5. RESTRICCIONES
- No uses símbolos matemáticos complejos que rompan el formato (usa texto plano).
- Si el material es Inoxidable (ISO M) o Titanio (ISO S), advierte sobre el endurecimiento por deformación si el avance es muy bajo.
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
