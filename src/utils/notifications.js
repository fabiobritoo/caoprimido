import notifee, {
  AndroidImportance,
  AndroidVisibility,
  AndroidCategory,
  TriggerType,
  RepeatFrequency,
} from '@notifee/react-native';

const CANAL_ID = 'remedios';

export async function pedirPermissoes() {
  await notifee.requestPermission();

  await notifee.createChannel({
    id: CANAL_ID,
    name: 'Alarmes de remédio',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    visibility: AndroidVisibility.PUBLIC,
  });

  return true;
}

// Cancela uma lista de alarmes agendados (usado ao editar/excluir remédio)
export async function cancelarAlarmes(notificationIds = []) {
  for (const id of notificationIds) {
    try {
      await notifee.cancelTriggerNotification(id);
    } catch (e) {
      // alarme já pode não existir mais, ignora
    }
  }
}

// Próxima ocorrência de um horário "HH:MM" a partir de agora (hoje se ainda não passou, senão amanhã)
function proximaOcorrenciaDiaria(hora, minuto) {
  const agora = new Date();
  const data = new Date();
  data.setHours(hora, minuto, 0, 0);
  if (data.getTime() <= agora.getTime()) {
    data.setDate(data.getDate() + 1);
  }
  return data;
}

// Próxima ocorrência de um dia da semana (0=domingo) + horário
function proximaOcorrenciaSemanal(diaSemanaJs, hora, minuto) {
  const agora = new Date();
  const data = new Date();
  data.setHours(hora, minuto, 0, 0);
  let diasAte = diaSemanaJs - data.getDay();
  if (diasAte < 0 || (diasAte === 0 && data.getTime() <= agora.getTime())) {
    diasAte += 7;
  }
  data.setDate(data.getDate() + diasAte);
  return data;
}

async function criarAlarme(titulo, corpo, trigger) {
  return notifee.createTriggerNotification(
    {
      title: titulo,
      body: corpo,
      android: {
        channelId: CANAL_ID,
        category: AndroidCategory.ALARM,
        importance: AndroidImportance.HIGH,
        sound: 'default',
        loopSound: true, // toca repetidamente até o usuário interagir (igual despertador)
        pressAction: { id: 'default' },
        fullScreenAction: { id: 'default' }, // acorda a tela / mostra por cima do bloqueio
        autoCancel: true,
      },
    },
    trigger
  );
}

/**
 * Agenda os alarmes de um remédio de acordo com a frequência escolhida.
 * remedio.frequencia pode ser:
 *   { tipo: 'diaria' }
 *   { tipo: 'dias_semana', dias: [0,2,4] }  // 0=domingo ... 6=sábado
 *   { tipo: 'intervalo', intervaloDias: 2, dataInicio, proximaData: 'YYYY-MM-DD' }
 * Retorna a lista de notificationIds agendados.
 */
export async function agendarAlarmesRemedio(remedio) {
  const { nome, dosagem, horarios, frequencia } = remedio;
  const corpo = `Dose: ${dosagem}`;
  const idsAgendados = [];
  const titulo = `Hora de tomar: ${nome}`;

  if (!frequencia || frequencia.tipo === 'diaria') {
    for (const horario of horarios) {
      const [hora, minuto] = horario.split(':').map(Number);
      const data = proximaOcorrenciaDiaria(hora, minuto);
      const id = await criarAlarme(titulo, corpo, {
        type: TriggerType.TIMESTAMP,
        timestamp: data.getTime(),
        repeatFrequency: RepeatFrequency.DAILY,
        alarmManager: { allowWhileIdle: true },
      });
      idsAgendados.push(id);
    }
  } else if (frequencia.tipo === 'dias_semana') {
    for (const diaJs of frequencia.dias) {
      for (const horario of horarios) {
        const [hora, minuto] = horario.split(':').map(Number);
        const data = proximaOcorrenciaSemanal(diaJs, hora, minuto);
        const id = await criarAlarme(titulo, corpo, {
          type: TriggerType.TIMESTAMP,
          timestamp: data.getTime(),
          repeatFrequency: RepeatFrequency.WEEKLY,
          alarmManager: { allowWhileIdle: true },
        });
        idsAgendados.push(id);
      }
    }
  } else if (frequencia.tipo === 'intervalo') {
    // Sem repetição nativa "a cada N dias": agenda só a próxima data.
    // O app reagenda a seguinte automaticamente quando é aberto
    // (veja reagendarAlarmesIntervalo).
    const proxima = new Date(frequencia.proximaData + 'T00:00:00');
    for (const horario of horarios) {
      const [hora, minuto] = horario.split(':').map(Number);
      const dataComHora = new Date(proxima);
      dataComHora.setHours(hora, minuto, 0, 0);

      if (dataComHora.getTime() > Date.now()) {
        const id = await criarAlarme(titulo, corpo, {
          type: TriggerType.TIMESTAMP,
          timestamp: dataComHora.getTime(),
          alarmManager: { allowWhileIdle: true },
        });
        idsAgendados.push(id);
      }
    }
  }

  return idsAgendados;
}

// Soma dias a uma data no formato 'YYYY-MM-DD' e devolve outra string 'YYYY-MM-DD'
export function somarDias(dataString, dias) {
  const data = new Date(dataString + 'T00:00:00');
  data.setDate(data.getDate() + dias);
  return data.toISOString().split('T')[0];
}

/**
 * Verifica remédios do tipo "intervalo" cuja data agendada já passou
 * e reagenda a próxima automaticamente. Chame isso quando o app abre.
 */
export async function reagendarAlarmesIntervalo(remedios, salvarRemedios) {
  const hoje = new Date().toISOString().split('T')[0];
  let houveMudanca = false;

  const novaLista = [];
  for (const remedio of remedios) {
    if (remedio.frequencia?.tipo === 'intervalo' && remedio.frequencia.proximaData < hoje) {
      await cancelarAlarmes(remedio.notificationIds);

      const novaProximaData = somarDias(hoje, remedio.frequencia.intervaloDias);
      const remedioAtualizado = {
        ...remedio,
        frequencia: { ...remedio.frequencia, proximaData: novaProximaData },
      };
      const novosIds = await agendarAlarmesRemedio(remedioAtualizado);
      remedioAtualizado.notificationIds = novosIds;

      novaLista.push(remedioAtualizado);
      houveMudanca = true;
    } else {
      novaLista.push(remedio);
    }
  }

  if (houveMudanca) {
    await salvarRemedios(novaLista);
  }
  return novaLista;
}

// Dispara um aviso imediato de estoque baixo (notificação comum, não é alarme)
export async function avisarEstoqueBaixo(remedioNome, quantidadeAtual, unidade) {
  await notifee.displayNotification({
    title: 'Estoque baixo!',
    body: `${remedioNome} está acabando (restam ${quantidadeAtual} ${unidade}). Hora de comprar mais.`,
    android: {
      channelId: CANAL_ID,
      importance: AndroidImportance.HIGH,
      pressAction: { id: 'default' },
    },
  });
}
