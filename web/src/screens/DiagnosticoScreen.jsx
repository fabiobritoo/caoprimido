import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Copy, Send, Timer, Repeat, Check } from 'lucide-react';
import { RAIO, criarBotaoPrimario, criarBotaoSecundario } from '../utils/tema.js';
import { useTema } from '../utils/ThemeContext.jsx';
import CabecalhoTopo from '../components/CabecalhoTopo.jsx';
import { obterIdDispositivo, listarRemedios } from '../utils/storage.js';
import { renovarInscricaoPush } from '../utils/notifications.js';
import { VERSAO } from '../utils/versao.js';

const fmtHora = (ms) =>
  ms
    ? new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '—';

const fmtSeg = (ms) => (ms == null ? '—' : `${(ms / 1000).toFixed(1)}s`);

function resumirSub(sub) {
  if (!sub) return null;
  let servico = '';
  try {
    servico = new URL(sub.endpoint).host;
  } catch {
    servico = 'inválido';
  }
  return { servico, final: sub.endpoint.slice(-12), expiracao: sub.expirationTime ?? null };
}

async function coletarLocal() {
  const ua = navigator.userAgent;
  const info = {
    versao: VERSAO,
    deviceId: obterIdDispositivo(),
    userAgent: ua,
    plataforma: /iPhone|iPad|iPod/i.test(ua) ? 'iOS' : /Android/i.test(ua) ? 'Android' : 'outra',
    instalado: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
    permissao: typeof Notification !== 'undefined' ? Notification.permission : 'sem suporte',
    online: navigator.onLine,
    fuso: Intl.DateTimeFormat().resolvedOptions().timeZone,
    horaLocal: new Date().toString(),
    conexao: navigator.connection
      ? `${navigator.connection.effectiveType || '?'}${navigator.connection.saveData ? ' (economia de dados)' : ''}`
      : 'n/d',
    bateria: null,
    sw: null,
    subscription: null,
    estadoPush: null,
    logRecebidos: [],
  };

  try {
    if (navigator.getBattery) {
      const b = await navigator.getBattery();
      info.bateria = `${Math.round(b.level * 100)}%${b.charging ? ' (carregando)' : ''}`;
    }
  } catch {
    // sem suporte
  }

  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) {
      info.sw = {
        ativo: reg.active?.state || 'nenhum',
        aguardando: !!reg.waiting,
        controlando: !!navigator.serviceWorker.controller,
        escopo: reg.scope,
      };
      info.subscription = resumirSub(await reg.pushManager.getSubscription());
      try {
        info.estadoPush = await reg.pushManager.permissionState({ userVisibleOnly: true });
      } catch {
        // ignora
      }
    } else {
      info.sw = { ativo: 'sem registro' };
    }
  } catch (e) {
    info.sw = { ativo: `erro: ${e.message}` };
  }

  try {
    const cache = await caches.open('caoprimido-pushlog');
    const pedidos = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith('/__pushlog/'));
    const itens = await Promise.all(pedidos.map(async (r) => (await cache.match(r)).json()));
    info.logRecebidos = itens.sort((a, b) => b.recebidoEm - a.recebidoEm).slice(0, 30);
  } catch {
    // ignora
  }

  return info;
}

function montarRelatorio({ local, servidor, doses, offsetRelogioMs, erroServidor, acoes }) {
  const L = [];
  L.push('=== DIAGNÓSTICO CÃOPRIMIDO ===');
  L.push(`Gerado em: ${new Date().toString()}`);
  L.push('');
  L.push('--- APARELHO ---');
  if (local) {
    L.push(`Versão do app: ${local.versao}`);
    L.push(`Plataforma: ${local.plataforma} | Instalado na tela inicial: ${local.instalado ? 'sim' : 'NÃO (aba do navegador)'}`);
    L.push(`Permissão de notificação: ${local.permissao} | Estado do push: ${local.estadoPush || 'n/d'}`);
    L.push(`Online: ${local.online} | Conexão: ${local.conexao} | Bateria: ${local.bateria || 'n/d'}`);
    L.push(`Fuso: ${local.fuso}`);
    L.push(`Service Worker: ${JSON.stringify(local.sw)}`);
    L.push(
      `Inscrição push local: ${
        local.subscription
          ? `${local.subscription.servico} …${local.subscription.final} (expira: ${local.subscription.expiracao ?? 'nunca'})`
          : 'NENHUMA'
      }`
    );
    L.push(`deviceId: ${local.deviceId}`);
    L.push(`User agent: ${local.userAgent}`);
  }
  L.push('');
  L.push('--- SERVIDOR ---');
  if (erroServidor) {
    L.push(`ERRO ao consultar: ${erroServidor}`);
  } else if (servidor) {
    L.push(`Hora do servidor: ${servidor.horaServidor} (BR) | Redis respondeu em ${servidor.redisMs} ms`);
    L.push(`Diferença de relógio aparelho↔servidor: ${offsetRelogioMs != null ? `${(offsetRelogioMs / 1000).toFixed(1)}s` : 'n/d'}`);
    L.push(`Dispositivo registrado: ${servidor.registrado ? 'sim' : 'NÃO'} | No conjunto de dispositivos: ${servidor.noConjuntoDeDispositivos ? 'sim' : 'NÃO'}`);
    L.push(`Último sync do app: ${servidor.atualizadoEm ? new Date(servidor.atualizadoEm).toString() : 'nunca'}`);
    L.push(`Remédios no servidor: ${servidor.quantidadeRemedios} | Cuidador ativo: ${servidor.cuidadorAtivo} | Telegram próprio ativo: ${servidor.telegramProprioAtivo}`);
    L.push(
      `Inscrição push no servidor: ${
        servidor.subscription ? `${servidor.subscription.servico} …${servidor.subscription.final}` : 'NENHUMA'
      }`
    );
    if (local?.subscription && servidor.subscription) {
      const igual = local.subscription.final === servidor.subscription.final;
      L.push(`Inscrição do aparelho == inscrição do servidor: ${igual ? 'SIM' : 'NÃO (DIFERENTES!)'}`);
    }
    if (servidor.testeAgendado) {
      L.push(`Teste agendado: ${fmtHora(servidor.testeAgendado.enviarApos)} (urgência ${servidor.testeAgendado.urgency})`);
    }
  }
  L.push('');
  L.push('--- ÚLTIMOS ENVIOS DO SERVIDOR (mais recente primeiro) ---');
  if (servidor?.log?.length) {
    for (const e of servidor.log) {
      L.push(
        `${fmtHora(e.t)} | ${e.tipo}${e.rem ? ` ${e.rem} ${e.hor}` : ''}${e.tent ? ` #${e.tent}` : ''}${e.urg ? ` urg=${e.urg}` : ''} | resposta do push: ${e.status ?? 'sem resposta'}${e.erro ? ` | ERRO: ${e.erro}` : ''}`
      );
    }
  } else {
    L.push('(nenhum envio registrado — o servidor ainda não enviou nada desde a versão 1.44.0)');
  }
  L.push('');
  L.push('--- ÚLTIMOS PUSHES RECEBIDOS NO APARELHO ---');
  if (local?.logRecebidos?.length) {
    for (const r of local.logRecebidos) {
      const lat = r.enviadoEm ? r.recebidoEm - r.enviadoEm : null;
      L.push(
        `recebido ${fmtHora(r.recebidoEm)} | enviado ${fmtHora(r.enviadoEm)} | atraso ${fmtSeg(lat)} | ${r.tipo} ${r.titulo}${r.erro ? ` | ERRO AO EXIBIR: ${r.erro}` : ''}`
      );
    }
  } else {
    L.push('(nenhum push recebido registrado)');
  }
  L.push('');
  L.push('--- DOSES DE HOJE (visão do servidor) ---');
  if (doses?.length) {
    for (const d of doses) L.push(`${d.horario} ${d.remedio}: ${d.status}${d.detalhe ? ` (${d.detalhe})` : ''}`);
  } else {
    L.push('(nenhuma)');
  }
  if (acoes?.length) {
    L.push('');
    L.push('--- AÇÕES DESTA SESSÃO ---');
    L.push(...acoes);
  }
  return L.join('\n');
}

export default function DiagnosticoScreen() {
  const { CORES } = useTema();
  const estilos = criarEstilos(CORES);
  const [carregando, setCarregando] = useState(true);
  const [local, setLocal] = useState(null);
  const [servidor, setServidor] = useState(null);
  const [doses, setDoses] = useState(null);
  const [erroServidor, setErroServidor] = useState(null);
  const [offsetRelogioMs, setOffsetRelogioMs] = useState(null);
  const [urgencia, setUrgencia] = useState('high');
  const [ocupado, setOcupado] = useState(false);
  const [acoes, setAcoes] = useState([]);
  const [copiado, setCopiado] = useState(false);

  const registrarAcao = useCallback((texto) => {
    setAcoes((a) => [`${fmtHora(Date.now())} ${texto}`, ...a].slice(0, 15));
  }, []);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroServidor(null);
    setLocal(await coletarLocal());
    const deviceId = obterIdDispositivo();
    try {
      const t0 = Date.now();
      const resposta = await fetch(`/api/status?deviceId=${deviceId}&diagnostico=1`, { cache: 'no-store' });
      const t1 = Date.now();
      const json = await resposta.json();
      if (!resposta.ok) throw new Error(json.erro || `HTTP ${resposta.status}`);
      setServidor(json.diagnostico);
      setOffsetRelogioMs(json.diagnostico.agoraMs - (t0 + t1) / 2);
      setDoses(json.doses || []);
    } catch (e) {
      setErroServidor(e.message);
    }
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const testarAgora = async () => {
    setOcupado(true);
    try {
      const r = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: obterIdDispositivo(), urgency: urgencia }),
      });
      const j = await r.json();
      registrarAcao(
        `Teste imediato (urgência ${urgencia}): resposta do serviço de push = ${j.statusPush ?? 'nenhuma'} em ${j.ms ?? '?'} ms${j.erro ? ` | ERRO: ${JSON.stringify(j.erro).slice(0, 150)}` : ''}`
      );
    } catch (e) {
      registrarAcao(`Teste imediato falhou: ${e.message}`);
    }
    setOcupado(false);
    setTimeout(carregar, 4000);
  };

  const agendarTeste = async () => {
    setOcupado(true);
    try {
      const r = await fetch('/api/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: obterIdDispositivo(), urgency: urgencia, aposSegundos: 120 }),
      });
      const j = await r.json();
      if (r.ok) {
        registrarAcao(`Teste (urgência ${urgencia}) agendado para ${fmtHora(j.enviarApos)} — o cron envia entre 0 e 4 min depois disso. BLOQUEIE A TELA agora.`);
      } else {
        registrarAcao(`Agendamento falhou: ${j.erro || r.status}`);
      }
    } catch (e) {
      registrarAcao(`Agendamento falhou: ${e.message}`);
    }
    setOcupado(false);
  };

  const renovar = async () => {
    setOcupado(true);
    const resultado = await renovarInscricaoPush(obterIdDispositivo(), await listarRemedios());
    registrarAcao(resultado.ok ? 'Inscrição push renovada e reenviada ao servidor.' : `Falha ao renovar inscrição: ${resultado.erro}`);
    setOcupado(false);
    carregar();
  };

  const relatorio = montarRelatorio({ local, servidor, doses, offsetRelogioMs, erroServidor, acoes });

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(relatorio);
    } catch {
      const area = document.getElementById('relatorio-diagnostico');
      if (area) {
        area.focus();
        area.select();
        try {
          document.execCommand('copy');
        } catch {
          // o usuário ainda pode copiar manualmente da caixa
        }
      }
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div style={{ minHeight: '100%', backgroundColor: CORES.fundo, paddingBottom: 40 }}>
      <CabecalhoTopo titulo="Diagnóstico" mostrarVoltar />

      <div style={{ padding: 16 }}>
        <button onClick={copiar} style={{ ...criarBotaoPrimario(CORES), width: '100%', marginBottom: 10 }}>
          {copiado ? <Check size={16} strokeWidth={2.5} /> : <Copy size={16} strokeWidth={2.3} />}
          {copiado ? 'Copiado!' : 'Copiar relatório completo'}
        </button>
        <button onClick={carregar} disabled={carregando} style={{ ...criarBotaoSecundario(CORES), width: '100%', marginBottom: 18 }}>
          <RefreshCw size={15} strokeWidth={2.3} />
          {carregando ? 'Atualizando...' : 'Atualizar dados'}
        </button>

        <div style={estilos.titulo}>Testes de notificação</div>
        <div style={estilos.texto}>
          Urgência do push (alta = entrega imediata mesmo com o aparelho em economia de bateria):
        </div>
        <div style={estilos.linhaUrgencia}>
          {['high', 'normal'].map((u) => (
            <button
              key={u}
              onClick={() => setUrgencia(u)}
              style={{
                ...estilos.chip,
                ...(urgencia === u ? estilos.chipAtivo : {}),
              }}
            >
              {u === 'high' ? 'Alta' : 'Normal'}
            </button>
          ))}
        </div>
        <button onClick={testarAgora} disabled={ocupado} style={estilos.botaoAcao}>
          <Send size={15} strokeWidth={2.3} /> Enviar teste agora
        </button>
        <div style={estilos.dica}>Testa só o caminho servidor → serviço de push → aparelho (tela ligada).</div>
        <button onClick={agendarTeste} disabled={ocupado} style={estilos.botaoAcao}>
          <Timer size={15} strokeWidth={2.3} /> Agendar teste em 2 min (bloqueie a tela)
        </button>
        <div style={estilos.dica}>
          Sai pelo mesmo caminho dos lembretes reais (cron). Toque e bloqueie o celular, e espere uns 5 minutos.
        </div>
        <button onClick={renovar} disabled={ocupado} style={estilos.botaoAcao}>
          <Repeat size={15} strokeWidth={2.3} /> Renovar inscrição push
        </button>
        <div style={estilos.dica}>Descarta a inscrição atual e cria uma nova. Útil se o servidor responde OK mas nada chega.</div>

        {acoes.length > 0 && (
          <div style={estilos.cardMono}>
            {acoes.map((a, i) => (
              <div key={i} style={{ marginBottom: 6 }}>{a}</div>
            ))}
          </div>
        )}

        <div style={estilos.titulo}>Resumo</div>
        {erroServidor && <div style={{ ...estilos.texto, color: CORES.perigoTexto }}>Erro ao consultar o servidor: {erroServidor}</div>}
        {local && (
          <div style={estilos.card}>
            <Linha estilos={estilos} k="Plataforma" v={`${local.plataforma} · ${local.instalado ? 'instalado' : 'NÃO instalado (aba)'}`} />
            <Linha estilos={estilos} k="Permissão" v={`${local.permissao} / push: ${local.estadoPush || 'n/d'}`} />
            <Linha estilos={estilos} k="Service Worker" v={local.sw?.ativo || '—'} />
            <Linha estilos={estilos} k="Inscrição no aparelho" v={local.subscription ? `${local.subscription.servico} …${local.subscription.final}` : 'NENHUMA'} />
            {servidor && (
              <>
                <Linha estilos={estilos} k="Inscrição no servidor" v={servidor.subscription ? `${servidor.subscription.servico} …${servidor.subscription.final}` : 'NENHUMA'} />
                <Linha
                  estilos={estilos}
                  k="Iguais?"
                  v={local.subscription && servidor.subscription ? (local.subscription.final === servidor.subscription.final ? 'sim' : 'NÃO') : '—'}
                />
                <Linha estilos={estilos} k="Último sync" v={servidor.atualizadoEm ? new Date(servidor.atualizadoEm).toLocaleString('pt-BR') : 'nunca'} />
                <Linha estilos={estilos} k="Relógio (aparelho↔servidor)" v={offsetRelogioMs != null ? `${(offsetRelogioMs / 1000).toFixed(1)}s` : '—'} />
              </>
            )}
          </div>
        )}

        <div style={estilos.titulo}>Últimos envios do servidor</div>
        <div style={estilos.cardMono}>
          {servidor?.log?.length ? (
            servidor.log.slice(0, 10).map((e, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                {fmtHora(e.t)} {e.tipo}
                {e.rem ? ` ${e.rem} ${e.hor}` : ''} → {e.status ?? 'sem resposta'}
                {e.erro ? ` (${e.erro})` : ''}
              </div>
            ))
          ) : (
            <div>Nenhum envio registrado ainda.</div>
          )}
        </div>

        <div style={estilos.titulo}>Últimos pushes recebidos aqui</div>
        <div style={estilos.cardMono}>
          {local?.logRecebidos?.length ? (
            local.logRecebidos.slice(0, 10).map((r, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                {fmtHora(r.recebidoEm)} {r.tipo} · atraso {fmtSeg(r.enviadoEm ? r.recebidoEm - r.enviadoEm : null)}
                {r.erro ? ` · ERRO: ${r.erro}` : ''}
              </div>
            ))
          ) : (
            <div>Nenhum push recebido registrado ainda.</div>
          )}
        </div>

        <div style={estilos.titulo}>Doses de hoje</div>
        {doses && doses.length === 0 && <div style={estilos.texto}>Nenhuma dose agendada para hoje.</div>}
        {doses?.map((d, i) => (
          <div key={i} style={estilos.card}>
            <div style={estilos.nomeHorario}>
              {d.remedio} · {d.horario}
            </div>
            <div style={estilos.status}>{d.status}</div>
            {d.detalhe && <div style={estilos.detalhe}>{d.detalhe}</div>}
          </div>
        ))}

        <div style={estilos.titulo}>Relatório (se o botão de copiar não funcionar, selecione aqui)</div>
        <textarea id="relatorio-diagnostico" readOnly value={relatorio} style={estilos.caixaRelatorio} />
      </div>
    </div>
  );
}

function Linha({ estilos, k, v }) {
  return (
    <div style={estilos.linha}>
      <span style={estilos.chave}>{k}</span>
      <span style={estilos.valor}>{v}</span>
    </div>
  );
}

function criarEstilos(CORES) {
  const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12 };
  return {
    titulo: { fontWeight: 700, color: CORES.textoPrincipal, margin: '22px 0 8px', fontSize: 15 },
    texto: { color: CORES.textoSecundario, marginTop: 6, fontSize: 13 },
    dica: { color: CORES.textoSecundario, fontSize: 12, margin: '4px 2px 12px' },
    linhaUrgencia: { display: 'flex', gap: 8, margin: '8px 0 12px' },
    chip: {
      flex: 1,
      padding: '10px 0',
      borderRadius: RAIO.pill,
      border: `1.5px solid ${CORES.borda}`,
      backgroundColor: CORES.fundoCard,
      color: CORES.textoPrincipal,
      fontWeight: 600,
    },
    chipAtivo: { borderColor: CORES.botaoPrimarioFundo || CORES.primaria, color: CORES.botaoPrimarioFundo || CORES.primaria },
    botaoAcao: { ...criarBotaoSecundario(CORES), width: '100%', marginTop: 6 },
    card: {
      backgroundColor: CORES.fundoCard,
      borderRadius: 12,
      padding: 14,
      marginBottom: 10,
      boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    },
    cardMono: {
      ...mono,
      backgroundColor: CORES.fundoCard,
      color: CORES.textoPrincipal,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      wordBreak: 'break-word',
    },
    linha: { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0', fontSize: 13 },
    chave: { color: CORES.textoSecundario },
    valor: { color: CORES.textoPrincipal, fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' },
    nomeHorario: { fontWeight: 700, color: CORES.textoPrincipal },
    status: { color: CORES.primariaEscura, marginTop: 4, fontSize: 14 },
    detalhe: { color: CORES.textoSecundario, marginTop: 2, fontSize: 13 },
    caixaRelatorio: {
      ...mono,
      width: '100%',
      minHeight: 220,
      boxSizing: 'border-box',
      backgroundColor: CORES.fundoCard,
      color: CORES.textoPrincipal,
      border: `1px solid ${CORES.borda}`,
      borderRadius: 12,
      padding: 10,
    },
  };
}
