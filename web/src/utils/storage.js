import { formatarData, doseDoDia } from './constantes.js';
import { removerComprasDoRemedio } from './compras.js';

const CHAVE_REMEDIOS = '@caoprimido:lista';
const CHAVE_REGISTROS = '@caoprimido:registros';
const CHAVE_DISPOSITIVO = '@caoprimido:dispositivoId';

export function obterIdDispositivo() {
  let id = localStorage.getItem(CHAVE_DISPOSITIVO);
  if (!id) {
    // id imprevisível (é ele que separa um celular do outro no servidor)
    const bytes = new Uint8Array(16);
    (globalThis.crypto || window.crypto).getRandomValues(bytes);
    id = 'dev_' + Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
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

  // "Excluir permanentemente" apaga o histórico também: doses registradas e
  // compras desse remédio (antes ficavam órfãs, ocupando espaço e entrando no backup)
  const registros = await obterRegistros();
  const restantes = {};
  for (const chave in registros) {
    if (!chave.startsWith(`${id}|`)) restantes[chave] = registros[chave];
  }
  await salvarRegistros(restantes);
  await removerComprasDoRemedio(id);
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

// "Tomada" = realmente tomada. Dose pulada de propósito ("pulei") também fica
// registrada, mas não conta como tomada — ver doseResolvida
export function doseTomada(registros, remedioId, data, horario) {
  const r = registros[chaveRegistro(remedioId, data, horario)];
  return !!r && !r.pulada;
}

export function dosePulada(registros, remedioId, data, horario) {
  return !!registros[chaveRegistro(remedioId, data, horario)]?.pulada;
}

export function motivoDoPulo(registros, remedioId, data, horario) {
  return registros[chaveRegistro(remedioId, data, horario)]?.motivo || '';
}

// Resolvida = já tratada, seja tomada ou pulada: para de lembrar, sai dos pendentes
export function doseResolvida(registros, remedioId, data, horario) {
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
  const estavaPulada = !!registros[chave]?.pulada;
  // com fases de dose, desconta a dose que valia NAQUELE dia
  const porDose = doseDoDia(remedio, data);

  const novosRegistros = { ...registros };
  if (estavaTomado) {
    delete novosRegistros[chave];
  } else {
    novosRegistros[chave] = { tomadoEm: Date.now() };
  }
  await salvarRegistros(novosRegistros);

  // desfazer uma dose pulada não devolve estoque (nada foi descontado)
  const delta = estavaPulada ? 0 : estavaTomado ? porDose : -porDose;
  const listaRemedios = await listarRemedios();
  const novaLista = listaRemedios.map((r) => {
    if (r.id !== remedio.id) return r;
    // estoque não informado: não inventa um número (antes virava 0)
    if (r.quantidadeAtual == null || r.quantidadeAtual === '') return r;
    // arredonda pra evitar resíduos de ponto flutuante (ex.: 0,30000000000000004)
    const novo = Math.round((Number(r.quantidadeAtual) + delta) * 1000) / 1000;
    return { ...r, quantidadeAtual: Math.max(0, novo) };
  });
  await salvarRemedios(novaLista);

  return { remedios: novaLista, registros: novosRegistros, tomadoAgora: !estavaTomado };
}

// Marca a dose como pulada de propósito (com motivo opcional). Não mexe no estoque.
export async function pularDose(remedio, data, horario, motivo = '') {
  const registros = await obterRegistros();
  const chave = chaveRegistro(remedio.id, data, horario);
  const novosRegistros = { ...registros };
  novosRegistros[chave] = { pulada: true, motivo: motivo.trim().slice(0, 120), tomadoEm: Date.now() };
  await salvarRegistros(novosRegistros);
  const remedios = await listarRemedios();
  return { remedios, registros: novosRegistros };
}

// Marca várias doses (mesmo dia/horário) como tomadas de uma vez
export async function tomarVarias(itens, data) {
  let ultimo = null;
  for (const { remedio, horario } of itens) {
    const regs = await obterRegistros();
    if (regs[chaveRegistro(remedio.id, data, horario)]) continue;
    ultimo = await alternarDose(remedio, data, horario);
  }
  return ultimo || { remedios: await listarRemedios(), registros: await obterRegistros() };
}
