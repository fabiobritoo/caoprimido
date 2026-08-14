import React, { useState } from 'react';
import { Share, Plus, MoreVertical, SquarePlus, Smartphone } from 'lucide-react';
import { RAIO, SOMBRA } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';

export default function ComoInstalarScreen() {
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const [aba, setAba] = useState('android');

  const passosAndroid = [
    {
      icone: <MoreVertical size={20} />,
      titulo: 'Abra o menu do navegador',
      texto: 'Toque nos três pontinhos no canto superior direito do Chrome.',
    },
    {
      icone: <SquarePlus size={20} />,
      titulo: '"Instalar aplicativo" ou "Adicionar à tela inicial"',
      texto: 'O nome muda um pouco conforme a versão do Chrome, mas a opção fica no mesmo menu.',
    },
    {
      icone: <Smartphone size={20} />,
      titulo: 'Confirme a instalação',
      texto: 'O Cãoprimido aparece como um app normal na sua tela inicial, com ícone próprio.',
    },
  ];

  const passosIphone = [
    {
      icone: <Share size={20} />,
      titulo: 'Toque no botão de Compartilhar',
      texto: 'É o ícone de quadrado com uma seta pra cima, na barra inferior do Safari (precisa ser o Safari, não funciona em outros navegadores no iPhone).',
    },
    {
      icone: <Plus size={20} />,
      titulo: '"Adicionar à Tela de Início"',
      texto: 'Role a lista de opções que aparece até encontrar essa opção.',
    },
    {
      icone: <Smartphone size={20} />,
      titulo: 'Toque em "Adicionar"',
      texto: 'O ícone do Cãoprimido aparece na sua tela inicial, e as notificações passam a funcionar (no iPhone, elas só funcionam com o app instalado assim).',
    },
  ];

  const passos = aba === 'android' ? passosAndroid : passosIphone;

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo="Como instalar" mostrarVoltar />

      <div style={estilos.seletorAbas}>
        <button
          onClick={() => setAba('android')}
          style={{ ...estilos.aba, ...(aba === 'android' ? estilos.abaAtiva : {}) }}
        >
          Android
        </button>
        <button
          onClick={() => setAba('iphone')}
          style={{ ...estilos.aba, ...(aba === 'iphone' ? estilos.abaAtiva : {}) }}
        >
          iPhone
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {passos.map((passo, i) => (
          <div key={i} style={estilos.cartaoPasso}>
            <div style={estilos.numeroPasso}>{i + 1}</div>
            <div style={estilos.iconePasso}>{passo.icone}</div>
            <div style={{ flex: 1 }}>
              <div style={estilos.tituloPasso}>{passo.titulo}</div>
              <div style={estilos.textoPasso}>{passo.texto}</div>
            </div>
          </div>
        ))}

        <div style={estilos.notaFinal}>
          {aba === 'iphone'
            ? 'Depois de instalado, sempre abra o Cãoprimido pelo ícone na tela inicial (não pelo Safari) — assim os lembretes funcionam corretamente.'
            : 'Instalado, o app abre mais rápido, ocupa menos espaço que um app de loja, e as notificações funcionam mesmo com o app fechado.'}
        </div>
      </div>
    </div>
  );
}

function criarEstilos(CORES) {
  return {
    seletorAbas: {
      display: 'flex',
      backgroundColor: CORES.fundoCard,
      borderBottom: `1px solid ${CORES.borda}`,
      padding: '0 16px',
    },
    aba: {
      flex: 1,
      background: 'none',
      border: 'none',
      padding: '14px 0',
      fontSize: 15,
      fontWeight: 600,
      color: CORES.textoSecundario,
      borderBottom: '3px solid transparent',
    },
    abaAtiva: {
      color: CORES.primaria,
      borderBottom: `3px solid ${CORES.primaria}`,
    },
    cartaoPasso: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      backgroundColor: CORES.fundoCard,
      borderRadius: RAIO.medio,
      padding: 14,
      marginBottom: 10,
      boxShadow: SOMBRA.card,
      position: 'relative',
    },
    numeroPasso: {
      position: 'absolute',
      top: -8,
      left: -8,
      width: 22,
      height: 22,
      borderRadius: RAIO.pill,
      backgroundColor: CORES.primaria,
      color: '#fff',
      fontSize: 12,
      fontWeight: 700,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconePasso: {
      width: 38,
      height: 38,
      borderRadius: RAIO.pequeno,
      backgroundColor: CORES.primariaClara,
      color: CORES.primaria,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    tituloPasso: { fontWeight: 700, fontSize: 14, color: CORES.textoPrincipal, marginBottom: 3 },
    textoPasso: { fontSize: 13, color: CORES.textoSecundario, lineHeight: 1.5 },
    notaFinal: {
      fontSize: 13,
      color: CORES.textoSecundario,
      backgroundColor: CORES.primariaClara,
      borderRadius: RAIO.pequeno,
      padding: 12,
      marginTop: 8,
      lineHeight: 1.5,
    },
  };
}
