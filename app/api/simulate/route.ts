import { NextRequest, NextResponse } from 'next/server';

// Precisa rodar em ambiente Node (não Edge) para lidar com FormData/arquivos
export const runtime = 'nodejs';

// Modelo de imagem do Google (apelidado de "Nano Banana"), acessado pela API
// gratuita do Google AI Studio. É conhecido justamente por preservar bem o
// rosto/identidade da pessoa ao editar a imagem.
const GEMINI_MODEL = 'gemini-2.5-flash-image';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Reforço de identidade: repetido em todos os prompts pra evitar que o
// modelo "recrie" o rosto em vez de só editar o sorriso.
const identityGuard =
  'Esta é uma edição pontual de foto, não uma imagem nova. Mantenha exatamente a mesma pessoa, mesmo rosto, mesmos olhos, nariz, pele, cabelo, pose, ângulo, roupas, fundo e iluminação da foto original. Não rejuvenesça e não altere nenhum outro traço do rosto. Edite apenas os dentes e, se necessário, a gengiva, dentro da boca já sorrindo na foto.';

const treatmentPrompts: Record<string, string> = {
  'Clareamento Dental':
    `${identityGuard} Ação: deixe os dentes visivelmente mais brancos e uniformes, como um clareamento dental profissional, mantendo o formato e alinhamento que os dentes já têm.`,
  'Facetas de Porcelana':
    `${identityGuard} Ação: substitua a aparência dos dentes por facetas de porcelana: dentes retos, alinhados, com tamanho e formato uniformes entre si, brancos e simétricos, corrigindo qualquer dente torto, desalinhado, gasto, pequeno ou irregular que a pessoa tenha hoje. O resultado deve parecer um sorriso perfeitamente alinhado, como o de um paciente que fez facetas.`,
  'Aparelho Invisível':
    `${identityGuard} Ação: alinhe os dentes que estão tortos ou desalinhados, simulando o resultado final de um tratamento com alinhador invisível — dentes mais retos e alinhados entre si, mas mantendo o formato e a cor natural dos dentes da pessoa (sem deixá-los artificialmente brancos como facetas).`,
  'Fechamento de Diastema':
    `${identityGuard} Ação: feche completamente o espaço (diastema) entre os dois dentes da frente, deixando-os encostados um no outro e o sorriso com os dentes juntos e alinhados.`,
  'Contorno Gengival':
    `${identityGuard} Ação: ajuste o contorno da gengiva, corrigindo excesso de gengiva aparente ou assimetria, para deixar o sorriso mais harmônico e proporcional entre dentes e gengiva.`,
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: 'GEMINI_API_KEY não configurada no servidor.' },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('image');
    const treatment = formData.get('treatment');

    if (!(file instanceof File) || typeof treatment !== 'string') {
      return NextResponse.json(
        { error: 'Envie uma imagem e selecione um tratamento.' },
        { status: 400 }
      );
    }

    const prompt = treatmentPrompts[treatment] ?? treatmentPrompts['Clareamento Dental'];

    // Converte a imagem enviada para base64 (formato que a API do Gemini espera)
    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');
    const mimeType = file.type || 'image/jpeg';

    const geminiResponse = await fetch(`${GEMINI_URL}?key=${process.env.GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inlineData: { mimeType, data: base64Image } },
            ],
          },
        ],
        // ESSENCIAL: sem isso o modelo pode responder só com texto e nunca com imagem
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    });

    const data = await geminiResponse.json();

    if (!geminiResponse.ok) {
      console.error('Erro da Gemini API:', JSON.stringify(data));
      return NextResponse.json(
        { error: data?.error?.message || 'Não foi possível gerar a simulação agora.' },
        { status: 502 }
      );
    }

    // Procura a parte da resposta que contém a imagem gerada
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p: any) => p.inlineData);
    const textPart = parts.find((p: any) => p.text)?.text;

    if (!imagePart?.inlineData?.data) {
      console.error('Resposta sem imagem. Texto retornado:', textPart, JSON.stringify(data).slice(0, 800));
      return NextResponse.json(
        {
          error: textPart
            ? `A IA não gerou imagem, ela respondeu: "${textPart}"`
            : 'A IA não retornou uma imagem válida. Tente outra foto.',
        },
        { status: 502 }
      );
    }

    const outMime = imagePart.inlineData.mimeType ?? 'image/png';
    return NextResponse.json({ image: `data:${outMime};base64,${imagePart.inlineData.data}` });
  } catch (err) {
    console.error('Erro inesperado em /api/simulate:', err);
    return NextResponse.json(
      { error: 'Erro interno ao gerar a simulação.' },
      { status: 500 }
    );
  }
}