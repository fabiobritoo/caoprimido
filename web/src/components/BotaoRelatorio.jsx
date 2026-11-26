import React, { useState } from 'react';
import { FileDown, Tag, Share2 } from 'lucide-react';
import { useTema } from '../utils/ThemeContext.jsx';
import { criarBotaoSecundario } from '../utils/tema.js';

// Botão que gera um dos relatórios em PDF. Usado na aba Relatórios (Saúde) e
// na tela de Remédios, pra o relatório de preços ficar à mão onde os preços moram.
export default function BotaoRelatorio({ tipo, rotulo, style }) {
  const { CORES, modoBob } = useTema();
  const [gerando, setGerando] = useState(false);

  async function gerar(compartilhar = false) {
    setGerando(true);
    try {
      if (tipo === 'preco') {
        const { gerarRelatorioPrecoPdf } = await import('../utils/relatorioPrecoPdf.js');
        await gerarRelatorioPrecoPdf({ modoBob, compartilhar });
      } else {
        const { gerarRelatorioPdf } = await import('../utils/relatorioPdf.js');
        await gerarRelatorioPdf({ modoBob, compartilhar });
      }
    } catch (e) {
      console.error('Erro ao gerar PDF', e);
      alert('Não consegui gerar o PDF agora. Tente de novo.');
    }
    setGerando(false);
  }

  const Icone = tipo === 'preco' ? Tag : FileDown;
  const podeCompartilhar = typeof navigator !== 'undefined' && !!navigator.share && !!navigator.canShare;
  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      <button onClick={() => gerar(false)} disabled={gerando} style={{ ...criarBotaoSecundario(CORES), flex: 1 }}>
        <Icone size={16} strokeWidth={2.3} />
        {gerando ? 'Gerando PDF...' : rotulo}
      </button>
      {podeCompartilhar && (
        <button
          onClick={() => gerar(true)}
          disabled={gerando}
          aria-label="Compartilhar PDF"
          style={{ ...criarBotaoSecundario(CORES), width: 52, padding: 0, flexShrink: 0 }}
        >
          <Share2 size={17} strokeWidth={2.3} />
        </button>
      )}
    </div>
  );
}
