import React, { useState } from 'react';
import { FileDown, Tag } from 'lucide-react';
import { useTema } from '../utils/ThemeContext.jsx';
import { criarBotaoSecundario } from '../utils/tema.js';

// Botão que gera um dos relatórios em PDF. Usado na aba Relatórios (Saúde) e
// na tela de Remédios, pra o relatório de preços ficar à mão onde os preços moram.
export default function BotaoRelatorio({ tipo, rotulo, style }) {
  const { CORES, modoBob } = useTema();
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      if (tipo === 'preco') {
        const { gerarRelatorioPrecoPdf } = await import('../utils/relatorioPrecoPdf.js');
        await gerarRelatorioPrecoPdf({ modoBob });
      } else {
        const { gerarRelatorioPdf } = await import('../utils/relatorioPdf.js');
        await gerarRelatorioPdf({ modoBob });
      }
    } catch (e) {
      console.error('Erro ao gerar PDF', e);
      alert('Não consegui gerar o PDF agora. Tente de novo.');
    }
    setGerando(false);
  }

  const Icone = tipo === 'preco' ? Tag : FileDown;
  return (
    <button onClick={gerar} disabled={gerando} style={{ ...criarBotaoSecundario(CORES), width: '100%', ...style }}>
      <Icone size={16} strokeWidth={2.3} />
      {gerando ? 'Gerando PDF...' : rotulo}
    </button>
  );
}
