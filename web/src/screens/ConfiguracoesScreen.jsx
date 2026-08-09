import React, { useState, useEffect } from 'react';
import { HeartHandshake, Save, RefreshCw, Moon, Sun, Send, Check, TestTube2, DownloadCloud } from 'lucide-react';
import { RAIO, criarBotaoPrimario, criarBotaoSecundario } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import { obterConfiguracoes, salvarConfiguracoes } from '../utils/configuracoes.js';
import { listarRemedios, obterIdDispositivo } from '../utils/storage.js';
import { sincronizarNotificacoesServidor } from '../utils/notifications.js';
import { verificarAtualizacao } from '../utils/atualizacao.js';
import { VERSAO } from '../utils/versao.js';

function gerarCodigo() {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem letras/numeros ambiguos
  let codigo = '';
  for (let i = 0; i < 6; i++) {
    codigo += caracteres[Math.floor(Math.random() * caracteres.length)];
  }
  return codigo;
}

export default function ConfiguracoesScreen() {
  const { CORES, modoEscuro, setModoEscuro } = useTema();
  const estilos = criarEstilos(CORES);
  const [cuidadorAtivo, setCuidadorAtivo] = useState(false);
  const [cuidadorChatId, setCuidadorChatId] = useState('');
  const [cuidadorNome, setCuidadorNome] = useState('');
  const [codigo] = useState(gerarCodigo);
  const [botUsername, setBotUsername] = useState(null);
  const [verificando, setVerificando] = useState(false);
  const [erroVerificacao, setErroVerificacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState('');
  const [verificandoAtualizacao, setVerificandoAtualizacao] = useState(false);
  const [statusAtualizacao, setStatusAtualizacao] = useState('');

  useEffect(() => {
    (async () => {
      const config = await obterConfiguracoes();
      setCuidadorAtivo(config.cuidadorAtivo);
      setCuidadorChatId(config.cuidadorChatId || '');
      setCuidadorNome(config.cuidadorNome || '');
    })();

    fetch('/api/telegram-bot-info')
      .then((r) => r.json())
      .then((d) => setBotUsername(d.username))
      .catch(() => {});
  }, []);

  async function checarAtualizacao() {
    setVerificandoAtualizacao(true);
    setStatusAtualizacao('Verificando...');
    const resultado = await verificarAtualizacao();
    if (resultado === 'atualizando') {
      setStatusAtualizacao('Nova versão encontrada! Atualizando...');
      // a página recarrega sozinha quando a troca terminar
    } else if (resultado === 'ja_atualizado') {
      setStatusAtualizacao(`Você já está na versão mais recente (v${VERSAO}).`);
      setVerificandoAtualizacao(false);
    } else {
      setStatusAtualizacao('Não consegui verificar agora. Tente de novo em instantes.');
      setVerificandoAtualizacao(false);
    }
  }

  async function verificarCodigo() {
    setVerificando(true);
    setErroVerificacao('');
    try {
      const resposta = await fetch(
        `/api/telegram-obter-chat-id?codigo=${codigo}&_=${Date.now()}`,
        { cache: 'no-store' }
      );
      const dados = await resposta.json();
      if (!resposta.ok) {
        setErroVerificacao(dados.erro || 'Ainda não recebi a mensagem.');
      } else {
        setCuidadorChatId(String(dados.chatId));
        setCuidadorNome(dados.nome);
        setCuidadorAtivo(true);

        // salva na hora, pra não depender de um segundo clique em "Salvar"
        const configAtualizada = {
          cuidadorAtivo: true,
          cuidadorChatId: String(dados.chatId),
          cuidadorNome: dados.nome,
        };
        await salvarConfiguracoes(configAtualizada);
        const remedios = await listarRemedios();
        await sincronizarNotificacoesServidor(obterIdDispositivo(), remedios, configAtualizada);
      }
    } catch (e) {
      setErroVerificacao('Falha ao verificar. Tente de novo.');
    }
    setVerificando(false);
  }

  async function enviarTeste() {
    setEnviandoTeste(true);
    setResultadoTeste('');
    try {
      const resposta = await fetch('/api/telegram-teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: obterIdDispositivo(), chatId: cuidadorChatId }),
      });
      const dados = await resposta.json();
      setResultadoTeste(
        resposta.ok ? '✓ Mensagem de teste enviada! Confira o Telegram.' : `Erro: ${dados.erro}`
      );
    } catch (e) {
      setResultadoTeste('Falha ao enviar. Tente de novo.');
    }
    setEnviandoTeste(false);
  }

  async function salvar() {
    setSalvando(true);
    const config = { cuidadorAtivo, cuidadorChatId, cuidadorNome };
    await salvarConfiguracoes(config);

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
          {modoEscuro ? <Moon size={20} color={CORES.primaria} /> : <Sun size={20} color={CORES.primaria} />}
          Aparência
        </div>

        <div style={estilos.linhaToggle}>
          <span style={estilos.label}>Modo escuro</span>
          <button
            onClick={() => setModoEscuro(!modoEscuro)}
            style={{
              ...estilos.toggle,
              backgroundColor: modoEscuro ? CORES.primaria : CORES.borda,
            }}
          >
            <div
              style={{
                ...estilos.toggleBolinha,
                transform: modoEscuro ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        </div>

        <div style={estilos.divisor} />

        <div style={estilos.secaoTitulo}>
          <DownloadCloud size={20} color={CORES.primaria} />
          Atualizações
        </div>
        <div style={estilos.explicacao}>
          Versão instalada: v{VERSAO}. Se o app parecer desatualizado, verifique
          aqui em vez de ficar fechando e abrindo várias vezes.
        </div>
        <button
          onClick={checarAtualizacao}
          disabled={verificandoAtualizacao}
          style={estilos.botaoVerificarAtualizacao}
        >
          <RefreshCw size={16} strokeWidth={2.3} className={verificandoAtualizacao ? 'girando' : ''} />
          {verificandoAtualizacao ? 'Verificando...' : 'Verificar atualização'}
        </button>
        {statusAtualizacao && <div style={estilos.statusAtualizacaoTexto}>{statusAtualizacao}</div>}

        <div style={estilos.divisor} />

        <div style={estilos.secaoTitulo}>
          <HeartHandshake size={20} color={CORES.primaria} />
          Avisar um cuidador/familiar
        </div>
        <div style={estilos.explicacao}>
          Se você não confirmar uma dose em 15 minutos, o app manda um aviso
          automático pelo Telegram pra outra pessoa (grátis, sem limite de mensagens).
        </div>

        <div style={estilos.linhaToggle}>
          <span style={estilos.label}>Ativar aviso ao cuidador</span>
          <button
            onClick={() => setCuidadorAtivo(!cuidadorAtivo)}
            style={{
              ...estilos.toggle,
              backgroundColor: cuidadorAtivo ? CORES.primaria : CORES.borda,
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
            {cuidadorChatId ? (
              <>
                <div style={estilos.conectadoBox}>
                  <Check size={18} color={CORES.sucesso} strokeWidth={2.5} />
                  <span>
                    Conectado com <strong>{cuidadorNome || 'cuidador'}</strong>
                  </span>
                  <button
                    onClick={() => {
                      setCuidadorChatId('');
                      setCuidadorNome('');
                    }}
                    style={estilos.linkTrocar}
                  >
                    trocar
                  </button>
                </div>

                <button onClick={enviarTeste} disabled={enviandoTeste} style={estilos.botaoTeste}>
                  <TestTube2 size={16} strokeWidth={2.3} />
                  {enviandoTeste ? 'Enviando...' : 'Enviar mensagem de teste'}
                </button>
                {resultadoTeste && <div style={estilos.resultadoTeste}>{resultadoTeste}</div>}
              </>
            ) : (
              <div style={estilos.instrucoes}>
                <strong>Como conectar (leva 1 minuto, é grátis):</strong>
                <ol style={{ paddingLeft: 20, margin: '10px 0' }}>
                  <li>
                    No Telegram, a pessoa que vai <strong>receber os avisos</strong> deve
                    procurar por{' '}
                    <strong>{botUsername ? `@${botUsername}` : '(configurando...)'}</strong>
                  </li>
                  <li>
                    Ela deve mandar exatamente este código pro bot:
                    <div style={estilos.codigoBox}>{codigo}</div>
                  </li>
                  <li>Depois, toque no botão abaixo pra confirmar</li>
                </ol>

                <button
                  onClick={verificarCodigo}
                  disabled={verificando || !botUsername}
                  style={estilos.botaoVerificar}
                >
                  <Send size={16} strokeWidth={2.3} />
                  {verificando ? 'Verificando...' : 'Já mandei — Verificar'}
                </button>

                {erroVerificacao && <div style={estilos.erroTexto}>{erroVerificacao}</div>}
              </div>
            )}
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

function criarEstilos(CORES) {
  return {
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
    divisor: { height: 1, backgroundColor: CORES.borda, margin: '20px 0' },
  botaoVerificarAtualizacao: {
    ...criarBotaoSecundario(CORES),
    width: '100%',
  },
  statusAtualizacaoTexto: {
    fontSize: 13,
    color: CORES.textoSecundario,
    marginTop: 10,
    textAlign: 'center',
  },
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
    instrucoes: {
      backgroundColor: CORES.primariaClara,
      borderRadius: 10,
      padding: 14,
      marginTop: 4,
      fontSize: 13,
      color: CORES.textoPrincipal,
      lineHeight: 1.6,
    },
    codigoBox: {
      display: 'inline-block',
      backgroundColor: CORES.fundoCard,
      border: `2px dashed ${CORES.primaria}`,
      borderRadius: RAIO.pequeno,
      padding: '6px 16px',
      fontSize: 20,
      fontWeight: 700,
      letterSpacing: 3,
      color: CORES.primariaEscura,
      marginTop: 6,
    },
    botaoVerificar: {
      ...criarBotaoSecundario(CORES),
      width: '100%',
      marginTop: 12,
    },
    erroTexto: { color: CORES.perigo, fontSize: 13, marginTop: 10 },
    conectadoBox: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      backgroundColor: CORES.sucessoFundo,
      borderRadius: RAIO.pequeno,
      padding: 14,
      fontSize: 14,
      color: CORES.textoPrincipal,
    },
    linkTrocar: {
      marginLeft: 'auto',
      background: 'none',
      border: 'none',
      color: CORES.primaria,
      fontSize: 13,
      textDecoration: 'underline',
    },
    botaoTeste: {
      ...criarBotaoSecundario(CORES),
      width: '100%',
      marginTop: 10,
    },
    resultadoTeste: {
      fontSize: 13,
      color: CORES.textoSecundario,
      marginTop: 8,
      textAlign: 'center',
    },
    botaoSalvar: {
      ...criarBotaoPrimario(CORES),
      width: '100%',
      marginTop: 30,
    },
  };
}
