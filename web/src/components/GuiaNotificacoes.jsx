import React, { useState } from 'react';
import { ChevronDown, ChevronUp, BatteryCharging } from 'lucide-react';
import { useTema } from '../utils/ThemeContext.jsx';
import { RAIO, SOMBRA } from '../utils/tema.js';

const MARCAS = [
  {
    id: 'xiaomi',
    nome: 'Xiaomi / Redmi / POCO (HyperOS ou MIUI)',
    teste: /xiaomi|redmi|poco|miui|hyperos/i,
    passos: [
      'Configurações › Aplicativos › Gerenciar aplicativos › Cãoprimido (ou Chrome, se não instalou o app).',
      'Ligue "Início automático" — foi isso que resolveu o atraso das notificações.',
      'Em "Economia de bateria", escolha "Sem restrições".',
      'Em "Notificações", deixe tudo permitido (inclusive "Tela de bloqueio").',
      'Na tela de apps recentes, puxe o card do app pra baixo e toque no cadeado, pra ele não ser encerrado.',
    ],
  },
  {
    id: 'samsung',
    nome: 'Samsung (One UI)',
    teste: /samsung|sm-[a-z0-9]/i,
    passos: [
      'Configurações › Aplicativos › Cãoprimido (ou Chrome) › Bateria › "Sem restrições".',
      'Configurações › Bateria › Limites de uso em segundo plano: tire o app de "Apps em suspensão" e "Apps em suspensão profunda", e desligue "Suspender apps não usados".',
      'Em Notificações do app, deixe tudo permitido.',
    ],
  },
  {
    id: 'motorola',
    nome: 'Motorola',
    teste: /motorola|moto /i,
    passos: [
      'Configurações › Apps › Cãoprimido (ou Chrome) › Bateria › "Sem restrições".',
      'Em Notificações do app, deixe tudo permitido.',
    ],
  },
  {
    id: 'outros',
    nome: 'Outros Androids',
    teste: /android/i,
    passos: [
      'Configurações › Apps › Cãoprimido (ou Chrome) › Bateria › "Sem restrições" (ou "Não otimizar").',
      'Se existir "Início automático" ou "Executar em segundo plano", ligue.',
      'Em Notificações do app, deixe tudo permitido.',
    ],
  },
  {
    id: 'iphone',
    nome: 'iPhone',
    teste: /iphone|ipad/i,
    passos: [
      'O app precisa estar instalado na Tela de Início (Compartilhar › Adicionar à Tela de Início).',
      'Ajustes › Notificações › Cãoprimido: permita tudo.',
      'Se usa Foco/Não Perturbe, deixe o Cãoprimido como app permitido.',
    ],
  },
];

function marcaDoAparelho() {
  const ua = navigator.userAgent || '';
  return (MARCAS.find((m) => m.teste.test(ua) && m.id !== 'outros') || MARCAS.find((m) => m.teste.test(ua)) || MARCAS[3]).id;
}

// "Notificações atrasando?" — passo a passo por marca do celular
export default function GuiaNotificacoes() {
  const { CORES } = useTema();
  const [aberto, setAberto] = useState(false);
  const [marca, setMarca] = useState(marcaDoAparelho);
  const atual = MARCAS.find((m) => m.id === marca);

  return (
    <div style={{ backgroundColor: CORES.fundoCard, borderRadius: RAIO.medio, boxShadow: SOMBRA.card, marginBottom: 14, overflow: 'hidden' }}>
      <button
        onClick={() => setAberto(!aberto)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', padding: '14px 16px', color: CORES.textoPrincipal, textAlign: 'left' }}
      >
        <BatteryCharging size={20} color={CORES.primaria} />
        <span style={{ flex: 1 }}>
          <span style={{ display: 'block', fontWeight: 700, fontSize: 15 }}>Notificações atrasando?</span>
          <span style={{ display: 'block', fontSize: 12.5, color: CORES.textoSecundario }}>Ajustes do celular que costumam resolver</span>
        </span>
        {aberto ? <ChevronUp size={20} color={CORES.textoSecundario} /> : <ChevronDown size={20} color={CORES.textoSecundario} />}
      </button>

      {aberto && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${CORES.borda}` }}>
          <div style={{ fontSize: 13, color: CORES.textoSecundario, margin: '12px 0 8px' }}>
            Muitos celulares suspendem apps em segundo plano pra economizar bateria, e a notificação chega atrasada (ou não chega). Escolha o seu:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {MARCAS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMarca(m.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: RAIO.pill,
                  border: `1.5px solid ${marca === m.id ? CORES.primaria : CORES.borda}`,
                  backgroundColor: marca === m.id ? CORES.primariaClara : 'transparent',
                  color: marca === m.id ? CORES.primariaEscura : CORES.textoSecundario,
                  fontWeight: 600,
                  fontSize: 12.5,
                }}
              >
                {m.id === 'xiaomi' ? 'Xiaomi' : m.id === 'samsung' ? 'Samsung' : m.id === 'motorola' ? 'Motorola' : m.id === 'iphone' ? 'iPhone' : 'Outro'}
              </button>
            ))}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: CORES.textoPrincipal, marginBottom: 6 }}>{atual.nome}</div>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, color: CORES.textoPrincipal, lineHeight: 1.5 }}>
            {atual.passos.map((p, i) => (
              <li key={i} style={{ marginBottom: 6 }}>{p}</li>
            ))}
          </ol>
          <div style={{ fontSize: 12.5, color: CORES.textoSecundario, marginTop: 8 }}>
            Depois use "Agendar teste em 2 min" abaixo, bloqueie a tela e veja se chega na hora.
          </div>
        </div>
      )}
    </div>
  );
}
