import { NextRequest, NextResponse } from 'next/server';

// Precisa rodar em ambiente Node (não Edge) para lidar com FormData/arquivos
export const runtime = 'nodejs';
// Geração de imagem pode demorar; dá mais tempo pra função (máx permitido no
// plano Hobby da Vercel é 60s).
export const maxDuration = 60;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — também evita estourar o limite de payload da Vercel

// Só os dois tratamentos que o cliente decidiu manter.
// A chave aqui É a validação: se o front mandar qualquer outro valor, a
// rota rejeita em vez de tentar adivinhar um prompt genérico.
const TREATMENTS = {
  'Clareamento Dental': {
    action:
      'Deixe os dentes visivelmente mais brancos e uniformes, como um clareamento dental profissional. Mantenha o formato e o alinhamento que os dentes já têm — não corrija tortos nem mude o tamanho dos dentes, só a cor.',
  },
  'Lentes de Porcelana': {
    action:
      'Substitua a aparência dos dentes por lentes/facetas de porcelana: dentes retos, alinhados entre si, com tamanho e formato uniformes, brancos e simétricos — corrigindo qualquer dente torto, desalinhado, gasto, pequeno, com espaçamento (diastema) ou irregular que a pessoa tenha hoje. O resultado deve parecer um sorriso perfeitamente alinhado e proporcional, como o de um paciente que fez lentes de contato dental.',
  },
} as const;

type TreatmentKey = keyof typeof TREATMENTS;

function buildPrompt(treatment: TreatmentKey): string {
  const identityGuard =
    'Esta é uma edição pontual de foto, não uma imagem nova. Mantenha exatamente: a mesma pessoa e o mesmo rosto, os mesmos olhos, nariz, pele, cabelo, pose, roupas e fundo. Não rejuvenesça e não altere nenhum outro traço facial.';

  const framingGuard =
    'MUITO IMPORTANTE — enquadramento: não corte a imagem, não altere o zoom, não mova nem redimensione a pessoa dentro do quadro, não gire nem incline a foto. A imagem de saída deve ter exatamente a mesma composição, os mesmos limites de borda, a mesma proporção e o mesmo enquadramento da imagem de entrada — como se fosse a mesma foto, só com o sorriso editado.';

  const scopeGuard =
    'A única parte que pode mudar são os dentes (e a gengiva, se necessário) dentro da boca já sorrindo na foto.';

  return `${identityGuard} ${framingGuard} ${scopeGuard} Ação desejada: ${TREATMENTS[treatment].action}`;
}

async function callOpenAI(base64Image: string, mimeType: string, fileName: string, prompt: string) {
  const openaiForm = new FormData();
  openaiForm.append('model', 'gpt-image-1');
  openaiForm.append(
    'image',
    new File([Buffer.from(base64Image, 'base64')], fileName, { type: mimeType })
  );
  openaiForm.append('prompt', prompt);
  openaiForm.append('size', 'auto'); // "auto" é o que melhor preserva a proporção/enquadramento original
  openaiForm.append('quality', 'medium');
  openaiForm.append('input_fidelity', 'high'); // crucial: preserva rosto/identidade na edição

  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: openaiForm,
  });
}

export async function POST(req: NextRequest) {
  try {
    // --- Validação de ambiente ---
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    // --- Validação da entrada ---
    const formData = await req.formData();
    const file = formData.get('image');
    const treatment = formData.get('treatment');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Envie uma imagem válida.' }, { status: 400 });
    }
    if (typeof treatment !== 'string' || !(treatment in TREATMENTS)) {
      return NextResponse.json(
        { error: `Tratamento inválido. Use um destes: ${Object.keys(TREATMENTS).join(', ')}.` },
        { status: 400 }
      );
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de imagem não suportado. Envie JPG, PNG ou WEBP.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande. Envie um arquivo de até 8MB.' }, { status: 400 });
    }

    const prompt = buildPrompt(treatment as TreatmentKey);
    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    // --- Chamada à IA, com uma tentativa extra em caso de erro transitório ---
    let openaiResponse = await callOpenAI(base64Image, file.type, file.name || 'foto.jpg', prompt);

    if (!openaiResponse.ok && openaiResponse.status >= 500) {
      openaiResponse = await callOpenAI(base64Image, file.type, file.name || 'foto.jpg', prompt);
    }

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('Erro da OpenAI:', JSON.stringify(data));
      const message =
        data?.error?.code === 'content_policy_violation' || data?.error?.type === 'image_generation_user_error'
          ? 'A foto ou o pedido não passou na checagem de conteúdo da IA. Tente outra foto.'
          : data?.error?.message || 'Não foi possível gerar a simulação agora. Tente novamente.';
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // --- Validação da resposta ---
    const base64Out = data?.data?.[0]?.b64_json;
    if (!base64Out) {
      console.error('Resposta sem imagem:', JSON.stringify(data).slice(0, 500));
      return NextResponse.json({ error: 'A IA não retornou uma imagem válida. Tente outra foto.' }, { status: 502 });
    }

    return NextResponse.json({ image: `data:image/png;base64,${base64Out}` });
  } catch (err) {
    console.error('Erro inesperado em /api/simulate:', err);
    return NextResponse.json({ error: 'Erro interno ao gerar a simulação.' }, { status: 500 });
  }
}