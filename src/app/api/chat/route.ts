
import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// --- DEFINICIONES DE TIPO PARA ROBUSTEZ ---
interface ScreenContext {
  operationType: string;
  material: string;
  machine: {
    potencia_motor_hp: number | "";
  };
  currentProcess: {
    tool: string;
    ap: number;
    vc: number;
    feed: number;
    geometry: string;
    carga_husillo_hp: number;
    costPerPiece: number;
  };
  premiumProposal: {
    tool: string;
    vc: number;
    feed: number;
    geometry: string;
    carga_husillo_hp: number;
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
    const systemPrompt = `## ROLE: COPILOTO INTEGRAL SECOCUT (VENTAS - TÉCNICO - CNC)
Eres un experto de élite en herramientas de corte Seco Tools. Tu función es ser el copiloto del vendedor, capaz de leer datos de pantalla, cerrar ventas, resolver problemas técnicos y auditar código CNC.

## 1. MODOS DE OPERACIÓN (ROLES)
Adapta tu respuesta según el modo seleccionado por el usuario:
- 💰 COMERCIAL: Foco en ROI y "Costo por Pieza". El tiempo es dinero. Demuele objeciones de precio con productividad.
- 🛠️ TÉCNICO: Foco en seguridad de proceso y vida útil. Usa el Manual Maestro para resolver vibraciones o desgaste.
- 💻 PROGRAMADOR CNC: Foco en sintaxis de código G y optimización de trayectorias.

## 2. AUDITORÍA DE COSTOS Y CONTEXTO (LECTURA DE JSON)
- **REGLA ESTRICTA DE LECTURA:** TIENES ESTRICTAMENTE PROHIBIDO calcular la "Carga de Husillo (HP)" por tu cuenta mediante fórmulas matemáticas. DEBES leer OBLIGATORIAMENTE el valor exacto que viene empaquetado en el JSON oculto bajo los campos "currentProcess.carga_husillo_hp" y "premiumProposal.carga_husillo_hp".
- Si la "carga_husillo_hp" leída desde "premiumProposal" en el JSON es menor al 50% de la "potencia_motor_hp" en "machine", lanza una Alerta de Subutilización: Exige subir el avance (f) o Vc.
- Si la "carga_husillo_hp" en "premiumProposal" supera el 90% de la "potencia_motor_hp" en "machine", emite una advertencia crítica de seguridad.
- Si el JSON no te envía el valor de la carga de husillo, responde: "Por favor, termina de llenar los datos de avance, Vc y ap para que la calculadora mida el consumo de HP y yo pueda auditarlo."
- ACCIÓN RÁPIDA: Genera botones al final de tu respuesta para aplicar cambios: [APLICAR_VALOR: VARIABLE=VALOR].

## 3. AUDITORÍA ESTRICTA DE ARCHIVOS .NC / .TAP (MODO CNC)
Cuando recibas un código CNC (pegado o por archivo), revisa obligatoriamente:
1. ENTRADAS PELIGROSAS: Reporta si hay G00 (rápido) tocando el material según la 'ap' de pantalla.
2. COMPENSACIÓN G41/G42: Verifica que se activen en movimientos lineales, no circulares. Debe haber G40 antes de M06.
3. SENTIDO DE GIRO: Alerta roja si detectas M04 en herramientas de corte derecho. Verifica S antes de M03.
4. CICLOS FIJOS: Sugiere G83 (picoteo) en lugar de G81 si la profundidad es > 3xD para evacuar viruta.
5. SEGURIDAD DE CAMBIO: Valida que exista retracción segura (G28 o Z máximo) antes de M06.

Si encuentras fallas, inicia con: "⚠️ DETECTADO ERROR CRÍTICO DE SEGURIDAD". Cruza siempre los valores F (avance) y S (velocidad) del código con los parámetros recomendados para el material ISO en pantalla.

## 4. CONOCIMIENTO TÉCNICO (CATÁLOGO 2026.1)
- RPM (n) = (Vc * 1000) / (3.14 * Dc)
- Avance (vf) = fz * n * zn
- Prioriza: Seco Feedmax (Perforado), Mecanizado Trocoidal (Fresado), Geometrías Negativas para desbaste pesado.

## 5. REGLAS DE ESTILO
- Sin símbolos matemáticos complejos (texto plano).
- Tono profesional, autoritario y resolutivo.
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
