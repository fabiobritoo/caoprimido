import { formatarData } from './constantes.js';

const CHAVE_REMEDIOS = '@caoprimido:lista';
const CHAVE_REGISTROS = '@caoprimido:registros';
const CHAVE_DISPOSITIVO = '@caoprimido:dispositivoId';

export function obterIdDispositivo() {
  let id = localStorage.getItem(CHAVE_DISPOSITIVO);
  if (!id) {
    id = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(CHAVE_DISPOSITIVO, id);
  }
  return id;
}

export async function listarRemedios() {
  try {
    const json = localStorage.getItem(CHAVE_REMEDIOS);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    console.error('Erro ao listar remédios', e);
    return [];
  }
}

export async function salvarRemedios(lista) {
  localStorage.setItem(CHAVE_REMEDIOS, JSON.stringify(lista));
}

export async function adicionarRemedio(remedio) {
  const lista = await listarRemedios();
  // guarda a data de criação, pra evolução/adesão não contar dias
  // anteriores ao cadastro como "deveria ter tomado e não tomou"
  const comData = { dataCriacao: formatarData(new Date()), ...remedio };
  lista.push(comData);
  await salvarRemedios(lista);
  return lista;
}

export async function atualizarRemedio(id, dadosAtualizados) {
  const lista = await listarRemedios();
  const novaLista = lista.map((r) => (r.id === id ? { ...r, ...dadosAtualizados } : r));
  await salvarRemedios(novaLista);
  return novaLista;
}

export async function removerRemedio(id) {
  const lista = await listarRemedios();
  const novaLista = lista.filter((r) => r.id !== id);
  await salvarRemedios(novaLista);
  return novaLista;
}

// ---- Registros de doses tomadas por dia+horário ----

export async function obterRegistros() {
  try {
    const json = localStorage.getItem(CHAVE_REGISTROS);
    return json ? JSON.parse(json) : {};
  } catch (e) {
    return {};
  }
}

async function salvarRegistros(registros) {
  localStorage.setItem(CHAVE_REGISTROS, JSON.stringify(registros));
}

function chaveRegistro(remedioId, data, horario) {
  return `${remedioId}|${data}|${horario}`;
}

export function doseTomada(registros, remedioId, data, horario) {
  return !!registros[chaveRegistro(remedioId, data, horario)];
}

// Devolve o momento exato (timestamp) em que a dose foi marcada como tomada, ou null
export function horarioRegistrado(registros, remedioId, data, horario) {
  const valor = registros[chaveRegistro(remedioId, data, horario)];
  return valor?.tomadoEm || null;
}

export async function alternarDose(remedio, data, horario) {
  const registros = await obterRegistros();
  const chave = chaveRegistro(remedio.id, data, horario);
  const estavaTomado = !!registros[chave];
  const porDose = remedio.quantidadePorDose || 1;

  const novosRegistros = { ...registros };
  if (estavaTomado) {
    delete novosRegistros[chave];
  } else {
    novosRegistros[chave] = { tomadoEm: Date.now() };
  }
  await salvarRegistros(novosRegistros);

  const delta = estavaTomado ? porDose : -porDose;
  const listaRemedios = await listarRemedios();
  const novaLista = listaRemedios.map((r) =>
    r.id === remedio.id
      ? { ...r, quantidadeAtual: Math.max(0, r.quantidadeAtual + delta) }
      : r
  );
  await salvarRemedios(novaLista);

  return { remedios: novaLista, registros: novosRegistros, tomadoAgora: !estavaTomado };
}
