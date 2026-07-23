import { NextRequest, NextResponse } from 'next/server';

// Precisa rodar em ambiente Node (não Edge) para lidar com FormData/arquivos
export const runtime = 'nodejs';

// Prompt específico para cada tratamento.
// A instrução de "mantenha o rosto e a iluminação iguais" é o que faz a IA
// editar SÓ os dentes, sem trocar a pessoa da foto.
const treatmentPrompts: Record<string, string> = {
  'Clareamento Dental':
    'Nesta foto de uma pessoa sorrindo, deixe os dentes visivelmente mais brancos e uniformes, como um clareamento dental profissional. Mantenha exatamente o mesmo rosto, a mesma pessoa, o mesmo enquadramento, a mesma iluminação e o mesmo fundo da foto original. Não altere mais nada além da cor dos dentes.',
  'Facetas de Porcelana':
    'Nesta foto de uma pessoa sorrindo, aplique o efeito de facetas de porcelana nos dentes: dentes brancos, uniformes, com formato levemente mais alinhado e simétrico. Mantenha exatamente o mesmo rosto, a mesma pessoa, o mesmo enquadramento, a mesma iluminação e o mesmo fundo da foto original.',
  'Aparelho Invisível':
    'Nesta foto de uma pessoa sorrindo, alinhe levemente os dentes, simulando o resultado de um tratamento com alinhador invisível (dentes mais retos e alinhados). Mantenha exatamente o mesmo rosto, a mesma pessoa, o mesmo enquadramento, a mesma iluminação e o mesmo fundo da foto original.',
  'Fechamento de Diastema':
    'Nesta foto de uma pessoa sorrindo, feche o espaço entre os dois dentes da frente (diastema), deixando o sorriso com os dentes juntos e alinhados. Mantenha exatamente o mesmo rosto, a mesma pessoa, o mesmo enquadramento, a mesma iluminação e o mesmo fundo da foto original.',
  'Contorno Gengival':
    'Nesta foto de uma pessoa sorrindo, ajuste levemente o contorno da gengiva para deixar o sorriso mais harmônico e proporcional. Mantenha exatamente o mesmo rosto, a mesma pessoa, o mesmo enquadramento, a mesma iluminação e o mesmo fundo da foto original.',
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