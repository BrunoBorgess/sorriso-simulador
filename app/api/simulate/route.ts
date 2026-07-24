import { NextRequest, NextResponse } from 'next/server';

// Precisa rodar em ambiente Node (não Edge) para lidar com FormData/arquivos
export const runtime = 'nodejs';
export const maxDuration = 60;

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024; // 8MB

// Um único tratamento, de propósito: menos superfície de erro, prompt bem
// calibrado especificamente pra esse caso.
const PROMPT = `Esta é uma edição pontual de foto, não uma imagem nova.

Mantenha exatamente: a mesma pessoa e o mesmo rosto, os mesmos olhos, nariz, pele, cabelo, pose, roupas e fundo. Não rejuvenesça e não altere nenhum outro traço facial.

Enquadramento: não corte a imagem, não altere o zoom, não mova nem redimensione a pessoa dentro do quadro, não gire nem incline a foto. A saída deve ter exatamente a mesma composição, os mesmos limites de borda, a mesma proporção e o mesmo enquadramento da imagem de entrada.

Ação (aplique de forma clara e visível, não sutil): substitua a aparência dos dentes por lentes de contato dental de porcelana. Os dentes devem ficar: bem brancos (tom branco natural de porcelana, tipo BL1/BL2, não cinza nem amarelado), com formato retangular uniforme, todos do mesmo tamanho e alinhados perfeitamente em linha reta, sem nenhum dente torto, sem espaçamento entre eles, sem sobreposição. Corrija qualquer imperfeição que os dentes tenham hoje: dentes tortos, desalinhados, gastos, pequenos, escuros ou com espaçamento — o resultado final deve ser visivelmente diferente do original, como um sorriso de resultado de tratamento odontológico estético profissional.

Cuidado com a anatomia (muito importante para não parecer artificial): mantenha a anatomia natural do dente humano — os incisivos centrais (os dois da frente) devem ser levemente maiores que os incisivos laterais ao lado, e os caninos devem ter a ponta discretamente mais afiada, não quadrada. As bordas incisais devem ter uma leve translucidez natural (mais transparente/acinzentada bem sutil na pontinha), não um branco 100% opaco e chapado. Não deixe os dentes com aparência de dentadura, chiclete ou "piano key" (todos idênticos e planos) — deve parecer um trabalho odontológico real, não uma textura genérica. Mantenha o mesmo número de dentes visíveis que aparecem na foto original (não adicione nem remova dentes) e mantenha o encontro natural entre os dentes de cima e de baixo, sem deformar o lábio, o sorriso ou a gengiva.

A única parte da imagem que muda são os dentes dentro da boca já sorrindo na foto — todo o resto permanece idêntico.`;

async function callOpenAI(base64Image: string, mimeType: string, fileName: string) {
  const openaiForm = new FormData();
  openaiForm.append('model', 'gpt-image-1');
  openaiForm.append('image', new File([Buffer.from(base64Image, 'base64')], fileName, { type: mimeType }));
  openaiForm.append('prompt', PROMPT);
  openaiForm.append('size', 'auto'); // preserva melhor a proporção/enquadramento original
  openaiForm.append('quality', 'high'); // Fluid Compute ativo = sem risco de timeout, então priorizamos qualidade/detalhe
  openaiForm.append('input_fidelity', 'high'); // preserva rosto/identidade

  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: openaiForm,
  });
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY não configurada no servidor.' }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get('image');

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Envie uma imagem válida.' }, { status: 400 });
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de imagem não suportado. Envie JPG, PNG ou WEBP.' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Imagem muito grande. Envie um arquivo de até 8MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64Image = Buffer.from(arrayBuffer).toString('base64');

    let openaiResponse = await callOpenAI(base64Image, file.type, file.name || 'foto.jpg');
    if (!openaiResponse.ok && openaiResponse.status >= 500) {
      openaiResponse = await callOpenAI(base64Image, file.type, file.name || 'foto.jpg');
    }

    const data = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('Erro da OpenAI:', JSON.stringify(data));
      const message =
        data?.error?.code === 'content_policy_violation' || data?.error?.type === 'image_generation_user_error'
          ? 'A foto não passou na checagem de conteúdo da IA. Tente outra foto.'
          : data?.error?.message || 'Não foi possível gerar a simulação agora. Tente novamente.';
      return NextResponse.json({ error: message }, { status: 502 });
    }

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