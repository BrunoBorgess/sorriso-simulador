'use client';

import React, { useState, useRef } from 'react';
import {
  Upload, Sparkles, Check, ChevronLeft, ChevronRight, User,
  Image as ImageIcon, RefreshCcw, PhoneIcon, AlertCircle
} from 'lucide-react';

const MAX_DIMENSION = 1440; // redimensiona fotos grandes antes de enviar

export default function SmileSimulator() {
  const [step, setStep] = useState(1);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sliderPosition, setSliderPosition] = useState(50);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const mockBeforeImage = "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=800&h=600";

  const resizeImage = (blob: Blob, fileName: string): Promise<File> =>
    new Promise((resolve, reject) => {
      const img = new window.Image();
      const url = URL.createObjectURL(blob);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas não suportado.'));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (outBlob) => {
            if (!outBlob) return reject(new Error('Falha ao processar a imagem.'));
            resolve(new File([outBlob], fileName, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.88
        );
      };
      img.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      img.src = url;
    });

  const setImage = async (blob: Blob, fileName: string) => {
    setError(null);
    try {
      const resized = await resizeImage(blob, fileName);
      setImageFile(resized);
      setPreviewUrl(URL.createObjectURL(resized));
      setResultImage(null);
      setStep(2);
    } catch {
      setError('Não foi possível processar essa imagem. Tente outra foto.');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato não suportado. Envie uma foto JPG, PNG ou WEBP.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError('Imagem muito grande (máx. 15MB).');
      return;
    }
    setImage(file, file.name);
  };

  const handleUseExample = async () => {
    setError(null);
    try {
      const res = await fetch(mockBeforeImage);
      const blob = await res.blob();
      await setImage(blob, 'exemplo.jpg');
    } catch {
      setError('Não foi possível carregar a foto de exemplo. Tente enviar sua própria foto.');
    }
  };

  const handleSimulate = async () => {
    if (!imageFile) return;
    setIsGenerating(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const res = await fetch('/api/simulate', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.error || 'Falha ao gerar simulação.');

      setResultImage(data.image);
      setSliderPosition(50);
      setStep(3);
    } catch (err: any) {
      setError(err?.message || 'Algo deu errado ao gerar a simulação. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const resetSimulation = () => {
    setImageFile(null);
    setPreviewUrl(null);
    setResultImage(null);
    setError(null);
    setStep(1);
    setSliderPosition(50);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-800" style={{ colorScheme: 'light' }}>
      <div className="max-w-7xl mx-auto">

        <div className="mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-4 text-gray-900">
            Simule suas <br />
            <span className="text-green-600">lentes de porcelana</span>
          </h1>
          <p className="text-gray-500 max-w-md text-base sm:text-lg">
            Veja como seu sorriso pode ficar com lentes de porcelana, gerado por inteligência artificial a partir da sua própria foto.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* LADO ESQUERDO: Controles */}
          <div className="space-y-6">

            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              {[
                { num: 1, label: 'Envie sua foto' },
                { num: 2, label: 'Gerar simulação' },
                { num: 3, label: 'Resultado' }
              ].map((s) => (
                <div key={s.num} className={`flex items-center gap-2 ${step >= s.num ? 'text-green-600 font-semibold' : 'text-gray-400'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 ${step >= s.num ? 'border-green-600 bg-green-50' : 'border-gray-300'}`}>
                    {s.num}
                  </div>
                  <span className="hidden sm:inline text-sm">{s.label}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center relative overflow-hidden">
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
                <div
                  onClick={() => !previewUrl && fileInputRef.current?.click()}
                  className={`w-full h-48 border-2 border-dashed rounded-xl flex flex-col items-center justify-center mb-4 transition-colors ${previewUrl ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100 cursor-pointer'}`}
                >
                  {previewUrl ? (
                    <div className="relative w-full h-full p-2">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-lg" />
                      <button onClick={(e) => { e.stopPropagation(); resetSimulation(); }} className="absolute top-4 right-4 bg-white/90 p-1.5 rounded-full text-red-500 hover:bg-white shadow-sm">
                        <RefreshCcw className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 text-green-600 mb-2" />
                      <p className="font-semibold text-gray-700">Clique para enviar sua foto</p>
                      <p className="text-xs text-gray-400 mt-2">JPG, PNG, WEBP • Máx: 15MB</p>
                    </>
                  )}
                </div>
                <div className="flex items-center w-full gap-4 my-2">
                  <div className="h-px bg-gray-200 flex-1"></div>
                  <span className="text-xs text-gray-400 uppercase">ou</span>
                  <div className="h-px bg-gray-200 flex-1"></div>
                </div>
                <button onClick={handleUseExample} className="w-full py-2 flex items-center justify-center gap-2 border border-green-600 text-green-600 rounded-lg font-medium hover:bg-green-50 transition">
                  <User className="w-4 h-4" /> Usar foto de exemplo
                </button>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4 text-sm">Dicas para uma melhor simulação</h3>
                  <ul className="space-y-3">
                    {['Use uma foto de frente', 'Ambiente bem iluminado', 'Sorria naturalmente', 'Sem óculos e filtros'].map((dica, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" /> {dica}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm p-4 rounded-xl">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleSimulate}
              disabled={!imageFile || isGenerating}
              className={`w-full py-4 rounded-xl text-lg font-bold flex items-center justify-center gap-2 transition-all ${!imageFile ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl hover:-translate-y-0.5'}`}
            >
              {isGenerating ? (
                <><RefreshCcw className="w-5 h-5 animate-spin" /> Aplicando Inteligência Artificial...</>
              ) : (
                <><Sparkles className="w-5 h-5" /> Gerar simulação das lentes de porcelana</>
              )}
            </button>
          </div>

          {/* LADO DIREITO: Resultados */}
          <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Resultado da simulação</h2>

            {!resultImage ? (
              <div className="flex-1 flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 min-h-[400px]">
                {isGenerating ? (
                  <>
                    <RefreshCcw className="w-12 h-12 text-green-500 animate-spin mb-4" />
                    <p className="text-gray-600 font-medium">Gerando sua simulação...</p>
                    <p className="text-sm text-gray-400 mt-2 text-center max-w-xs">Isso pode levar de 15 a 30 segundos.</p>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-16 h-16 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">Sua simulação aparecerá aqui</p>
                    <p className="text-sm text-gray-400 mt-2 text-center max-w-xs">Envie uma foto e clique em gerar para ver o resultado na sua própria foto.</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative w-full h-[300px] sm:h-[400px] rounded-2xl overflow-hidden select-none bg-gray-100">
                  <img src={resultImage} alt="Depois" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
                  <img
                    src={previewUrl!}
                    alt="Antes"
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                    style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
                  />
                  <input
                    type="range" min="0" max="100"
                    value={sliderPosition}
                    onChange={(e) => setSliderPosition(Number(e.target.value))}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                  />
                  <div className="absolute top-0 bottom-0 w-1 bg-white z-10 pointer-events-none" style={{ left: `${sliderPosition}%` }}>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full p-2 shadow-[0_0_15px_rgba(0,0,0,0.3)] flex items-center justify-center">
                      <ChevronLeft className="w-4 h-4 text-gray-700" />
                      <ChevronRight className="w-4 h-4 text-gray-700" />
                    </div>
                  </div>
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-lg text-sm font-bold text-gray-700 z-10 pointer-events-none shadow-sm">Antes</div>
                  <div className="absolute top-4 right-4 bg-green-600 px-3 py-1.5 rounded-lg text-sm font-bold text-white z-10 pointer-events-none shadow-sm">Depois</div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 text-center">
                  <h3 className="text-lg font-bold text-gray-900 mb-2">Gostou de ver na sua própria foto?</h3>
                  <p className="text-sm text-gray-600 mb-6">Agende uma avaliação com nossos especialistas e descubra o melhor tratamento para você.</p>
                  <button className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors mb-3">
                    <PhoneIcon className="w-5 h-5" /> Agendar avaliação pelo WhatsApp
                  </button>
                  <button onClick={resetSimulation} className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors">
                    <RefreshCcw className="w-4 h-4" /> Testar outra foto
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}