import React, { useState, useEffect } from 'react';
import { HeartHandshake, Save, RefreshCw } from 'lucide-react';
import { CORES, RAIO, botaoPrimario } from '../utils/tema.js';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import { obterConfiguracoes, salvarConfiguracoes } from '../utils/configuracoes.js';
import { listarRemedios, obterIdDispositivo } from '../utils/storage.js';
import { sincronizarNotificacoesServidor } from '../utils/notifications.js';

export default function ConfiguracoesScreen() {
  const [cuidadorAtivo, setCuidadorAtivo] = useState(false);
  const [cuidadorTelefone, setCuidadorTelefone] = useState('');
  const [cuidadorApiKey, setCuidadorApiKey] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    (async () => {
      const config = await obterConfiguracoes();
      setCuidadorAtivo(config.cuidadorAtivo);
      setCuidadorTelefone(config.cuidadorTelefone || '');
      setCuidadorApiKey(config.cuidadorApiKey || '');
    })();
  }, []);

  async function salvar() {
    setSalvando(true);
    const config = { cuidadorAtivo, cuidadorTelefone, cuidadorApiKey };
    await salvarConfiguracoes(config);

    // manda pro servidor junto com a lista de remédios (ele usa isso pra saber pra quem avisar)
    const remedios = await listarRemedios();
    await sincronizarNotificacoesServidor(obterIdDispositivo(), remedios, config);

    setSalvando(false);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2500);
  }

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo="Configurações" mostrarVoltar />

      <div style={{ padding: 20 }}>
        <div style={estilos.secaoTitulo}>
          <HeartHandshake size={20} color={CORES.primaria} />
          Avisar um cuidador/familiar
        </div>
        <div style={estilos.explicacao}>
          Se você não confirmar uma dose em 15 minutos, o app pode mandar um
          aviso automático por WhatsApp pra outra pessoa.
        </div>

        <div style={estilos.linhaToggle}>
          <span style={estilos.label}>Ativar aviso ao cuidador</span>
          <button
            onClick={() => setCuidadorAtivo(!cuidadorAtivo)}
            style={{
              ...estilos.toggle,
              backgroundColor: cuidadorAtivo ? CORES.primaria : '#DDD',
            }}
          >
            <div
              style={{
                ...estilos.toggleBolinha,
                transform: cuidadorAtivo ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        {cuidadorAtivo && (
          <>
            <label style={estilos.label}>
              Telefone do cuidador (com código do país, ex: 5511999999999)
            </label>
            <input
              style={estilos.input}
              placeholder="5511999999999"
              value={cuidadorTelefone}
              onChange={(e) => setCuidadorTelefone(e.target.value.replace(/\D/g, ''))}
            />

            <label style={estilos.label}>Chave do CallMeBot (apikey)</label>
            <input
              style={estilos.input}
              placeholder="123456"
              value={cuidadorApiKey}
              onChange={(e) => setCuidadorApiKey(e.target.value)}
            />

            <div style={estilos.instrucoes}>
              <strong>Como conseguir a chave (é grátis, leva 1 minuto):</strong>
              <ol style={{ paddingLeft: 20, margin: '8px 0' }}>
                <li>
                  A pessoa que vai <strong>receber</strong> os avisos deve adicionar o
                  número +34 644 59 71 67 nos contatos do WhatsApp dela
                </li>
                <li>
                  Ela manda a mensagem <code>I allow callmebot to send me messages</code>{' '}
                  pra esse número
                </li>
                <li>Vai chegar uma resposta com a "apikey" — cole ela no campo acima</li>
              </ol>
            </div>
          </>
        )}

        <button onClick={salvar} disabled={salvando} style={estilos.botaoSalvar}>
          <Save size={18} strokeWidth={2.3} />
          {salvando ? 'Salvando...' : salvo ? '✓ Salvo!' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  );
}

const estilos = {
  secaoTitulo: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 18,
    fontWeight: 700,
    color: CORES.textoPrincipal,
    marginBottom: 6,
  },
  explicacao: { color: CORES.textoSecundario, fontSize: 14, marginBottom: 20 },
  linhaToggle: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  label: { display: 'block', fontWeight: 600, marginTop: 14, marginBottom: 6, color: CORES.textoPrincipal },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    border: 'none',
    padding: 2,
    display: 'flex',
    alignItems: 'center',
  },
  toggleBolinha: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    transition: 'transform 0.2s',
  },
  input: {
    width: '100%',
    border: `1px solid ${CORES.borda}`,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  instrucoes: {
    backgroundColor: CORES.primariaClara,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
    fontSize: 13,
    color: CORES.textoPrincipal,
    lineHeight: 1.5,
  },
  botaoSalvar: {
    ...botaoPrimario,
    width: '100%',
    marginTop: 30,
  },
};
