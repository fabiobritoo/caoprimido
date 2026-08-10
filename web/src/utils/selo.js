import { formatarData, remedioAplicavelNoDia } from './constantes.js';
import { doseTomada } from './storage.js';

export function seloSuportado() {
  return 'setAppBadge' in navigator;
}

// Conta quantas doses de HOJE já passaram do horário e ainda não foram marcadas
export function contarDosesPendentes(remedios, registros) {
  const agora = new Date();
  const hoje = formatarData(agora);
  const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(
    agora.getMinutes()
  ).padStart(2, '0')}`;

  let contador = 0;
  for (const remedio of remedios) {
    if (!remedioAplicavelNoDia(remedio.frequencia, hoje, remedio.dataInicio, remedio.dataTermino)) continue;
    for (const horario of remedio.horarios || []) {
      if (horario > horaAtual) continue; // ainda não chegou a hora
      if (!doseTomada(registros, remedio.id, hoje, horario)) contador++;
    }
  }
  return contador;
}

export async function atualizarSeloLocal(remedios, registros) {
  if (!seloSuportado()) return;
  const contador = contarDosesPendentes(remedios, registros);
  try {
    if (contador > 0) {
      await navigator.setAppBadge(contador);
    } else {
      await navigator.clearAppBadge();
    }
  } catch (e) {
    // alguns navegadores podem recusar silenciosamente; sem problema
  }
}
