import React, { useEffect, useState } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import { observarNovaVersao, atualizarAgora } from '../utils/atualizacao.js';
import { VERSAO } from '../utils/versao.js';

// "Uma versão nova está disponível, quer atualizar?" — aparece ao abrir o app
// (e quando ele volta pra frente) se já existe uma versão nova baixada.
// "Depois" esconde até a próxima vez que o app for aberto.
export default function AvisoAtualizacao() {
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const [worker, setWorker] = useState(null);
  const [dispensado, setDispensado] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => observarNovaVersao((w) => setWorker(w)), []);

  if (!worker || dispensado) return null;

  function atualizar() {
    setAtualizando(true);
    atualizarAgora(worker);
  }

  return (
    <div style={estilos.fundo} role="dialog" aria-live="polite" aria-label="Nova versão disponível">
      <div style={estilos.cartao}>
        <div style={estilos.topo}>
          <div style={estilos.icone}>
            <Sparkles size={20} strokeWidth={2.2} color={CORES.primaria} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={estilos.titulo}>Uma versão nova está disponível</div>
            <div style={estilos.texto}>
              Quer atualizar agora? O app recarrega em instantes. Você está na v{VERSAO}.
            </div>
          </div>
        </div>
        <div style={estilos.botoes}>
          <button onClick={() => setDispensado(true)} disabled={atualizando} style={estilos.botaoDepois}>
            Depois
          </button>
          <button onClick={atualizar} disabled={atualizando} style={estilos.botaoAtualizar}>
            <RefreshCw size={16} strokeWidth={2.4} />
            {atualizando ? 'Atualizando...' : 'Atualizar agora'}
          </button>
        </div>
      </div>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    // abaixo da tela de alarme (zIndex 1000), acima do resto do app
    fundo: {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 900,
      padding: '0 12px calc(12px + env(safe-area-inset-bottom))',
      pointerEvents: 'none',
    },
    cartao: {
      pointerEvents: 'auto',
      maxWidth: 480,
      margin: '0 auto',
      backgroundColor: CORES.fundoCard,
      border: `1.5px solid ${CORES.primaria}`,
      borderRadius: RAIO.grande || RAIO.medio,
      boxShadow: SOMBRA.botao,
      padding: 14,
    },
    topo: { display: 'flex', gap: 12, alignItems: 'flex-start' },
    icone: {
      width: 38,
      height: 38,
      borderRadius: RAIO.pill,
      backgroundColor: CORES.primariaClara,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    titulo: { fontWeight: 700, fontSize: 15, color: CORES.textoPrincipal },
    texto: { fontSize: 13, color: CORES.textoSecundario, marginTop: 2 },
    botoes: { display: 'flex', gap: 8, marginTop: 12 },
    botaoDepois: {
      flex: 1,
      padding: '11px 0',
      borderRadius: RAIO.medio,
      border: `1.5px solid ${CORES.borda}`,
      backgroundColor: CORES.fundoCard,
      color: CORES.textoSecundario,
      fontWeight: 600,
      fontSize: 14,
    },
    botaoAtualizar: {
      flex: 2,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      padding: '11px 0',
      borderRadius: RAIO.medio,
      border: 'none',
      backgroundColor: CORES.botaoPrimarioFundo || CORES.primaria,
      color: CORES.textoBotaoPrimario || '#fff',
      fontWeight: 700,
      fontSize: 14,
    },
  };
}
