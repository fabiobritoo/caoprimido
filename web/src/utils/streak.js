import { formatarData, remedioAplicavelNoDia } from './constantes.js';
import { doseTomada } from './storage.js';

// Conta quantos dias seguidos (terminando hoje ou ontem) o usuário tomou
// TODAS as doses agendadas. Dias sem nenhum remédio agendado são pulados
// sem quebrar a sequência.
export function calcularSequenciaDias(remedios, registros) {
  let streak = 0;
  const hojeStr = formatarData(new Date());
  const cursor = new Date();

  for (let i = 0; i < 3650; i++) {
    const dataStr = formatarData(cursor);
    const dosesDoDia = [];

    for (const remedio of remedios) {
      if (!remedioAplicavelNoDia(remedio.frequencia, dataStr)) continue;
      for (const horario of remedio.horarios || []) {
        dosesDoDia.push({ remedioId: remedio.id, horario });
      }
    }

    if (dosesDoDia.length === 0) {
      cursor.setDate(cursor.getDate() - 1);
      continue; // dia sem remédio agendado não conta nem quebra
    }

    const todasTomadas = dosesDoDia.every((d) =>
      doseTomada(registros, d.remedioId, dataStr, d.horario)
    );

    if (!todasTomadas) {
      // se for hoje e o dia ainda não terminou, não penaliza — só não soma ainda
      if (dataStr === hojeStr) {
        cursor.setDate(cursor.getDate() - 1);
        continue;
      }
      break;
    }

    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}
