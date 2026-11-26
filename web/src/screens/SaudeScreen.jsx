import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import SaudeSecao from '../components/SaudeSecao.jsx';
import RelatoriosSecao from '../components/RelatoriosSecao.jsx';
import EvolucaoScreen from './EvolucaoScreen.jsx';
import ConsultasScreen from './ConsultasScreen.jsx';

const ABAS = [
  { id: 'adesao', rotulo: 'Adesão' },
  { id: 'corpo', rotulo: 'Corpo' },
  { id: 'consultas', rotulo: 'Consultas' },
  { id: 'relatorios', rotulo: 'Relatórios' },
];

// Tudo que é sobre acompanhar a saúde num lugar só:
// adesão aos remédios, peso/pressão, consultas e relatórios em PDF.
export default function SaudeScreen() {
  const { CORES } = useTema();
  const [parametros, setParametros] = useSearchParams();
  const aba = ABAS.some((a) => a.id === parametros.get('aba')) ? parametros.get('aba') : 'adesao';

  const estiloAba = (ativa) => ({
    flex: 1,
    background: 'none',
    border: 'none',
    padding: '14px 0',
    fontSize: 14,
    fontWeight: 600,
    color: ativa ? CORES.primaria : CORES.textoSecundario,
    borderBottom: `3px solid ${ativa ? CORES.primaria : 'transparent'}`,
  });

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo="Saúde" mostrarVoltar />

      <div style={{ display: 'flex', backgroundColor: CORES.fundoCard, borderBottom: `1px solid ${CORES.borda}`, padding: '0 8px' }}>
        {ABAS.map((a) => (
          <button key={a.id} onClick={() => setParametros({ aba: a.id }, { replace: true })} style={estiloAba(aba === a.id)}>
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'adesao' && <EvolucaoScreen />}
      {aba === 'corpo' && (
        <div style={{ padding: 16 }}>
          <SaudeSecao CORES={CORES} />
        </div>
      )}
      {aba === 'consultas' && <ConsultasScreen />}
      {aba === 'relatorios' && <RelatoriosSecao />}
    </div>
  );
}
