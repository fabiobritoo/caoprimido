import {
  remedioEstaAtivo,
  remedioAplicavelNoDia,
  formatarData,
  rotuloUnidade,
  fasesDoRemedio,
  calcularFasesComDatas,
  formatarQuantidade,
} from './constantes.js';

// Gera um arquivo de calendário (.ics) com um evento recorrente + alerta pra
// cada horário de cada remédio ativo. Esses alertas são tocados pelo app de
// Calendário do próprio celular (iPhone ou Android), no horário exato, mesmo
// sem internet, com a tela bloqueada e com o navegador suspenso — ao
// contrário do push, que depende do sistema entregar a mensagem.

const DIAS_ICS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function escapar(texto) {
  return String(texto).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

// linhas do iCalendar não podem passar de 75 bytes: continua na linha seguinte
// começando com um espaço
function dobrar(linha) {
  const bytes = new TextEncoder().encode(linha);
  if (bytes.length <= 75) return linha;
  const partes = [];
  let atual = '';
  let tamanho = 0;
  for (const ch of linha) {
    const t = new TextEncoder().encode(ch).length;
    if (tamanho + t > (partes.length === 0 ? 75 : 74)) {
      partes.push(atual);
      atual = '';
      tamanho = 0;
    }
    atual += ch;
    tamanho += t;
  }
  partes.push(atual);
  return partes.join('\r\n ');
}

function dataHoraLocal(dataStr, horario) {
  return `${dataStr.replace(/-/g, '')}T${horario.replace(':', '')}00`;
}

function somarDiasStr(dataStr, n) {
  const d = new Date(`${dataStr}T12:00:00`);
  d.setDate(d.getDate() + n);
  return formatarData(d);
}

// primeira data (a partir de "inicio") em que o remédio realmente é tomado,
// dentro da janela [inicioJanela, fimJanela]; garante que o evento recorrente
// comece alinhado com a frequência
function primeiraOcorrencia(remedio, inicio, inicioJanela, fimJanela) {
  for (let i = 0; i < 400; i++) {
    const dia = somarDiasStr(inicio, i);
    if (remedioAplicavelNoDia(remedio.frequencia, dia, inicioJanela, fimJanela)) return dia;
  }
  return null;
}

function regraRepeticao(remedio, fim) {
  const f = remedio.frequencia;
  let regra;
  if (!f || f.tipo === 'diaria') regra = 'FREQ=DAILY';
  else if (f.tipo === 'dias_semana') regra = `FREQ=WEEKLY;BYDAY=${(f.dias || []).map((d) => DIAS_ICS[d]).join(',')}`;
  else if (f.tipo === 'intervalo') regra = `FREQ=DAILY;INTERVAL=${f.intervaloDias || 1}`;
  else regra = 'FREQ=DAILY';
  if (fim) regra += `;UNTIL=${fim.replace(/-/g, '')}T235959`;
  return regra;
}

// Trechos de calendário de um remédio. Sem fases é um só (início→término).
// Com fases de dose, cada fase vira um trecho com a sua dose e o seu período,
// porque o título do alerta no Calendário leva a dose.
function trechosDoRemedio(remedio) {
  if (fasesDoRemedio(remedio).length === 0 || !remedio.dataInicio) {
    return [{ inicio: remedio.dataInicio || null, fim: remedio.dataTermino || null, dose: remedio.quantidadePorDose || 1, sufixoUid: '' }];
  }
  const fases = calcularFasesComDatas(fasesDoRemedio(remedio), remedio.dataInicio);
  return fases.map((f, i) => ({
    inicio: f.inicio,
    // o término geral do remédio, se houver, corta a última fase (ou qualquer uma)
    fim: f.fim && remedio.dataTermino ? (f.fim < remedio.dataTermino ? f.fim : remedio.dataTermino) : f.fim || remedio.dataTermino || null,
    dose: f.quantidadePorDose,
    // a 1ª fase mantém o UID antigo: reimportar substitui o evento que já
    // estava no Calendário em vez de duplicar
    sufixoUid: i === 0 ? '' : `-f${i + 1}`,
  }));
}

export function gerarCalendarioICS(remedios, agora = new Date()) {
  const hoje = formatarData(agora);
  const carimbo = agora.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Caoprimido//Alarmes de remedios//PT-BR',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:Cãoprimido',
  ];
  let total = 0;

  for (const remedio of remedios) {
    if (!remedioEstaAtivo(remedio, hoje)) continue;
    if (remedio.dataTermino && remedio.dataTermino < hoje) continue;

    for (const trecho of trechosDoRemedio(remedio)) {
      // fase que já terminou: não gera evento
      if (trecho.fim && trecho.fim < hoje) continue;

      const inicioBusca = trecho.inicio && trecho.inicio > hoje ? trecho.inicio : hoje;
      const primeira = primeiraOcorrencia(remedio, inicioBusca, trecho.inicio, trecho.fim);
      if (!primeira) continue;

      const dose = `${formatarQuantidade(trecho.dose)} ${rotuloUnidade(remedio.unidade).toLowerCase()}`;

      for (const horario of remedio.horarios || []) {
        total += 1;
        linhas.push(
          'BEGIN:VEVENT',
          // mesmo UID = reimportar atualiza o evento em vez de duplicar
          `UID:${remedio.id}-${horario.replace(':', '')}${trecho.sufixoUid}@caoprimido`,
          `DTSTAMP:${carimbo}`,
          `DTSTART:${dataHoraLocal(primeira, horario)}`,
          'DURATION:PT10M',
          `RRULE:${regraRepeticao(remedio, trecho.fim)}`,
          `SUMMARY:${escapar(`💊 ${remedio.nome} — ${dose}`)}`,
          `DESCRIPTION:${escapar('Hora do remédio! Abra o Cãoprimido pra confirmar que tomou.')}`,
          'TRANSP:TRANSPARENT',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          `DESCRIPTION:${escapar(`💊 ${remedio.nome} — ${dose}`)}`,
          'TRIGGER:PT0M',
          'END:VALARM',
          'END:VEVENT'
        );
      }
    }
  }

  linhas.push('END:VCALENDAR');
  return { conteudo: linhas.map(dobrar).join('\r\n') + '\r\n', total };
}

// Entrega o arquivo: no iPhone/Android abre a folha de compartilhar (onde
// aparece "Calendário"); onde não houver, baixa o arquivo.
export async function exportarAlarmesCalendario(remedios) {
  const { conteudo, total } = gerarCalendarioICS(remedios);
  if (total === 0) return { ok: false, motivo: 'Nenhum remédio ativo com horário cadastrado.' };

  const nomeArquivo = 'caoprimido-alarmes.ics';
  const arquivo = new File([conteudo], nomeArquivo, { type: 'text/calendar' });

  if (navigator.canShare?.({ files: [arquivo] })) {
    try {
      await navigator.share({ files: [arquivo], title: 'Alarmes do Cãoprimido' });
      return { ok: true, total, via: 'compartilhar' };
    } catch (e) {
      if (e?.name === 'AbortError') return { ok: false, cancelado: true };
      // outro erro: cai pro download comum
    }
  }

  const url = URL.createObjectURL(arquivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return { ok: true, total, via: 'download' };
}
