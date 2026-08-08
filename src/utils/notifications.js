import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Faz as notificações aparecerem mesmo com o app aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function pedirPermissoes() {
  const { status: statusAtual } = await Notifications.getPermissionsAsync();
  let status = statusAtual;

  if (statusAtual !== 'granted') {
    const { status: novoStatus } = await Notifications.requestPermissionsAsync();
    status = novoStatus;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('remedios', {
      name: 'Lembretes de remédio',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  }

  return status === 'granted';
}

// Cancela uma lista de notificações agendadas (usado ao editar/excluir remédio)
export async function cancelarAlarmes(notificationIds = []) {
  for (const id of notificationIds) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (e) {
      // notificação já pode não existir mais, ignora
    }
  }
}

// Converte "08:00" em { hora, minuto }
function parseHorario(horario) {
  const [hora, minuto] = horario.split(':').map(Number);
  return { hora, minuto };
}

// expo-notifications usa weekday de 1 (domingo) a 7 (sábado)
function diaSemanaParaExpo(diaJs) {
  return diaJs + 1;
}

/**
 * Agenda os alarmes de um remédio de acordo com a frequência escolhida.
 * remedio.frequencia pode ser:
 *   { tipo: 'diaria' }
 *   { tipo: 'dias_semana', dias: [0,2,4] }  // 0=domingo ... 6=sábado
 *   { tipo: 'intervalo', intervaloDias: 2, proximaData: 'YYYY-MM-DD' }
 * Retorna a lista de notificationIds agendados.
 */
export async function agendarAlarmesRemedio(remedio) {
  const { nome, dosagem, horarios, frequencia } = remedio;
  const corpo = `Dose: ${dosagem}`;
  const idsAgendados = [];

  if (!frequencia || frequencia.tipo === 'diaria') {
    // Repete todo dia, nos horários escolhidos
    for (const horario of horarios) {
      const { hora, minuto } = parseHorario(horario);
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: `Hora de tomar: ${nome}`, body: corpo, sound: 'default' },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: hora,
          minute: minuto,
          channelId: 'remedios',
        },
      });
      idsAgendados.push(id);
    }
  } else if (frequencia.tipo === 'dias_semana') {
    // Repete toda semana, nos dias e horários escolhidos
    for (const diaJs of frequencia.dias) {
      for (const horario of horarios) {
        const { hora, minuto } = parseHorario(horario);
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: `Hora de tomar: ${nome}`, body: corpo, sound: 'default' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: diaSemanaParaExpo(diaJs),
            hour: hora,
            minute: minuto,
            channelId: 'remedios',
          },
        });
        idsAgendados.push(id);
      }
    }
  } else if (frequencia.tipo === 'intervalo') {
    // O Expo não tem um gatilho nativo "a cada N dias", então agendamos
    // só a próxima data. O app reagenda a seguinte automaticamente
    // sempre que é aberto (veja reagendarAlarmesIntervalo).
    const proxima = new Date(frequencia.proximaData + 'T00:00:00');
    for (const horario of horarios) {
      const { hora, minuto } = parseHorario(horario);
      const dataComHora = new Date(proxima);
      dataComHora.setHours(hora, minuto, 0, 0);

      if (dataComHora.getTime() > Date.now()) {
        const id = await Notifications.scheduleNotificationAsync({
          content: { title: `Hora de tomar: ${nome}`, body: corpo, sound: 'default' },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: dataComHora,
            channelId: 'remedios',
          },
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
 * Recebe a lista de remédios e uma função para salvar a lista atualizada;
 * devolve a lista (possivelmente atualizada).
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

// Dispara um aviso imediato de estoque baixo
export async function avisarEstoqueBaixo(remedioNome, quantidadeAtual, unidade) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Estoque baixo!',
      body: `${remedioNome} está acabando (restam ${quantidadeAtual} ${unidade}). Hora de comprar mais.`,
      sound: 'default',
    },
    trigger: null, // dispara imediatamente
  });
}
