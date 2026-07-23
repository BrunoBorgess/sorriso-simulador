import { NextRequest, NextResponse } from 'next/server';

// Precisa rodar em ambiente Node (não Edge) para lidar com FormData/arquivos
export const runtime = 'nodejs';

// Prompt específico para cada tratamento.
// A instrução de "mantenha o rosto e a iluminação iguais" é o que faz a IA
// editar SÓ os dentes, sem trocar a pessoa da foto.
// Prefixo comum: reforça MUITO que é a mesma pessoa e a mesma foto,
// só editando os dentes. Repetir a instrução de identidade ajuda o modelo
// a não "recriar" o rosto.
const identityGuard =
  'IMPORTANTE: esta é uma edição pontual, não uma imagem nova. Mantenha 100% idêntico: a identidade e o rosto da mesma pessoa da foto original, o formato dos olhos, nariz, sobrancelhas, pele, cabelo, pose, ângulo da câmera, expressão, roupas, fundo e iluminação. Não rejuvenesça, não maquie, não suavize a pele e não altere nenhum traço facial. A única parte da imagem que pode mudar são os dentes, dentro da boca já aberta no sorriso.';

const treatmentPrompts: Record<string, string> = {
  'Clareamento Dental':
    `${identityGuard} Ação: deixe os dentes visivelmente mais brancos e uniformes, como um clareamento dental profissional, mantendo o mesmo formato de dente que a pessoa já tem.`,
  'Facetas de Porcelana':
    `${identityGuard} Ação: aplique o efeito de facetas de porcelana: dentes brancos, uniformes, com formato levemente mais alinhado e simétrico.`,
  'Aparelho Invisível':
    `${identityGuard} Ação: alinhe levemente os dentes, simulando o resultado de um tratamento com alinhador invisível (dentes mais retos e alinhados).`,
  'Fechamento de Diastema':
    `${identityGuard} Ação: feche o espaço entre os dois dentes da frente (diastema), deixando o sorriso com os dentes juntos e alinhados.`,
  'Contorno Gengival':
    `${identityGuard} Ação: ajuste levemente o contorno da gengiva para deixar o sorriso mais harmônico e proporcional.`,
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY não configurada no servidor.' },
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

    const openaiForm = new FormData();
    openaiForm.append('model', 'gpt-image-1');
    openaiForm.append('image', file, file.name || 'foto.png');
    openaiForm.append('prompt', prompt);
    openaiForm.append('size', 'auto');
    openaiForm.append('quality', 'medium'); // "low" | "medium" | "high" — medium é um bom custo/benefício pro protótipo
    openaiForm.append('input_fidelity', 'high'); // crucial: preserva rosto/identidade na edição (custa um pouco mais de tokens)
    openaiForm.append('n', '1');

    const openaiResponse = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: openaiForm,
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error('Erro da OpenAI:', errText);
      return NextResponse.json(
        { error: 'Não foi possível gerar a simulação agora. Tente novamente.' },
        { status: 502 }
      );
    }

    const data = await openaiResponse.json();
    const base64 = data?.data?.[0]?.b64_json;

    if (!base64) {
      return NextResponse.json(
        { error: 'A IA não retornou uma imagem válida.' },
        { status: 502 }
      );
    }

    return NextResponse.json({ image: `data:image/png;base64,${base64}` });
  } catch (err) {
    console.error('Erro inesperado em /api/simulate:', err);
    return NextResponse.json(
      { error: 'Erro interno ao gerar a simulação.' },
      { status: 500 }
    );
  }
}