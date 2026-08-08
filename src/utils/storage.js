import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAVE_REMEDIOS = '@remedios_app:lista';
const CHAVE_REGISTROS = '@remedios_app:registros';

// Estrutura de um remédio:
// {
//   id: string,
//   nome: string,
//   unidade: string,
//   quantidadePorDose: number,
//   dosagem: string,          // ex: "1 comprimido"
//   horarios: ['08:00', '20:00'],
//   frequencia: { tipo: 'diaria' } | { tipo: 'dias_semana', dias: [...] } | { tipo: 'intervalo', intervaloDias, dataInicio, proximaData },
//   quantidadeAtual: number,  // quantas unidades restam
//   quantidadeMinima: number, // avisa quando chegar nesse valor
//   notificationIds: []       // ids das notificações agendadas
// }

export async function listarRemedios() {
  try {
    const json = await AsyncStorage.getItem(CHAVE_REMEDIOS);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Erro ao listar remédios', e);
    return [];
  }
}

export async function salvarRemedios(lista) {
  try {
    await AsyncStorage.setItem(CHAVE_REMEDIOS, JSON.stringify(lista));
  } catch (e) {
    console.error('Erro ao salvar remédios', e);
  }
}

export async function adicionarRemedio(remedio) {
  const lista = await listarRemedios();
  lista.push(remedio);
  await salvarRemedios(lista);
  return lista;
}

export async function atualizarRemedio(id, dadosAtualizados) {
  const lista = await listarRemedios();
  const novaLista = lista.map((r) =>
    r.id === id ? { ...r, ...dadosAtualizados } : r
  );
  await salvarRemedios(novaLista);
  return novaLista;
}

export async function removerRemedio(id) {
  const lista = await listarRemedios();
  const novaLista = lista.filter((r) => r.id !== id);
  await salvarRemedios(novaLista);
  return novaLista;
}

// ---- Registros de doses tomadas por dia (para o histórico semanal) ----
// Guardado como objeto: { "remedioId|2026-08-08": true }

export async function obterRegistros() {
  try {
    const json = await AsyncStorage.getItem(CHAVE_REGISTROS);
    return json ? JSON.parse(json) : {};
  } catch (e) {
    console.error('Erro ao ler registros', e);
    return {};
  }
}

async function salvarRegistros(registros) {
  await AsyncStorage.setItem(CHAVE_REGISTROS, JSON.stringify(registros));
}

function chaveRegistro(remedioId, data, horario) {
  return `${remedioId}|${data}|${horario}`;
}

export function doseTomada(registros, remedioId, data, horario) {
  return !!registros[chaveRegistro(remedioId, data, horario)];
}

/**
 * Alterna o status de "tomado" de UM horário específico de um remédio num dia.
 * Ajusta o estoque automaticamente (desconta ao marcar, devolve ao desmarcar).
 * Retorna { remedios, registros, tomadoAgora } atualizados.
 */
export async function alternarDose(remedio, data, horario) {
  const registros = await obterRegistros();
  const chave = chaveRegistro(remedio.id, data, horario);
  const estavaTomado = !!registros[chave];
  const porDose = remedio.quantidadePorDose || 1;

  const novosRegistros = { ...registros };
  if (estavaTomado) {
    delete novosRegistros[chave];
  } else {
    novosRegistros[chave] = true;
  }
  await salvarRegistros(novosRegistros);

  const delta = estavaTomado ? porDose : -porDose; // desmarcar devolve estoque
  const listaRemedios = await listarRemedios();
  const novaLista = listaRemedios.map((r) =>
    r.id === remedio.id
      ? { ...r, quantidadeAtual: Math.max(0, r.quantidadeAtual + delta) }
      : r
  );
  await salvarRemedios(novaLista);

  return { remedios: novaLista, registros: novosRegistros, tomadoAgora: !estavaTomado };
}

// Registra que uma dose foi tomada: desconta a quantidade da dose do estoque
export async function registrarDoseTomada(id) {
  const lista = await listarRemedios();
  const novaLista = lista.map((r) => {
    if (r.id === id) {
      const porDose = r.quantidadePorDose || 1;
      const novaQuantidade = Math.max(0, r.quantidadeAtual - porDose);
      return { ...r, quantidadeAtual: novaQuantidade };
    }
    return r;
  });
  await salvarRemedios(novaLista);
  return novaLista;
}
