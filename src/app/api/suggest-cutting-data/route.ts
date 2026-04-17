import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const body = await req.json();
    const { material, quality, toolDesc } = body;

    // Validación básica
    if (!material || (!quality && !toolDesc)) {
      return NextResponse.json({ success: false, error: 'Faltan campos.' }, { status: 400 });
    }

    const systemPrompt = `
Eres el experto técnico de mecanizado de Seco Tools.
Tu objetivo es analizar el código comercial o grado de una plaquita (inserto) proporcionado por el usuario y recomendar las condiciones de corte de referencia: Profundidad de corte (ap), Avance por filo (fz o fn), y Velocidad de Corte (Vc).

El usuario provee:
1. Material: "${material}"
2. Grado/Calidad Seco: "${quality || 'No proveído'}"
3. Descripción/Código Seco: "${toolDesc || 'No proveído'}"

Instrucciones:
1. Detecta si es una herramienta de Torneado, Fresado, Taladrado u otra en base al código (ej. SNMG... es torneado, R220... es fresa).
2. Estima los rangos operativos base recomendados por Seco Tools o los más estándar para ese grado específico trabajando en el material indicado.
3. Debes responder estrictamente en formato JSON con los siguientes campos:
{
  "ap": "Rango de profundidad de corte en mm. Ej: 1.0 - 4.5 mm",
  "fz": "Rango de avance. Ej: 0.15 - 0.35 mm/rev",
  "vc": "Rango de velocidad de corte. Ej: 120 - 180 m/min",
  "notes": "Tu sugerencia o confirmación técnica breve (máximo 1 línea) de que los valores son de referencia para el grado provisto."
}
No proveas markdown, solo el JSON puro. Si por alguna razón el código no tiene sentido mecánico o no es un producto reconocible, devuelve valores "N/A" y en notes explica por qué.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Mini is fast and good enough for this
      messages: [{ role: 'system', content: systemPrompt }],
      response_format: { type: "json_object" },
      temperature: 0.2, // Low temp for more deterministic output
    });

    const responseContent = response.choices[0].message.content;
    const parsedData = JSON.parse(responseContent || "{}");

    return NextResponse.json({
      success: true,
      data: parsedData,
    });
  } catch (error: any) {
    console.error('Error al generar condiciones de corte:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Error interno' },
      { status: 500 }
    );
  }
}
