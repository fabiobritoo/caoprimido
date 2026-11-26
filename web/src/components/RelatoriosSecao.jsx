import React from 'react';
import { useTema } from '../utils/ThemeContext.jsx';
import { RAIO, SOMBRA } from '../utils/tema.js';
import BotaoRelatorio from './BotaoRelatorio.jsx';

// Aba "Relatórios" da tela Saúde: todos os PDFs num lugar só
export default function RelatoriosSecao() {
  const { CORES } = useTema();
  const cartao = {
    backgroundColor: CORES.fundoCard,
    borderRadius: RAIO.medio,
    padding: 16,
    marginBottom: 14,
    boxShadow: SOMBRA.card,
  };
  const titulo = { fontSize: 16, fontWeight: 700, color: CORES.textoPrincipal, marginBottom: 4 };
  const texto = { fontSize: 13.5, color: CORES.textoSecundario, marginBottom: 14, lineHeight: 1.4 };

  return (
    <div style={{ padding: 16 }}>
      <div style={cartao}>
        <div style={titulo}>Relatório para o médico</div>
        <div style={texto}>
          Seus dados, remédios (ativos e parados), adesão das últimas 12 semanas e registros de saúde (peso, pressão e
          frequência cardíaca).
        </div>
        <BotaoRelatorio tipo="geral" rotulo="Exportar relatório em PDF" />
      </div>

      <div style={cartao}>
        <div style={titulo}>Relatório de preços</div>
        <div style={texto}>
          Histórico de compras de cada remédio, variação do preço por unidade, local mais barato e custo mensal
          estimado.
        </div>
        <BotaoRelatorio tipo="preco" rotulo="Exportar relatório de preços" />
      </div>
    </div>
  );
}
