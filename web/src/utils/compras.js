const CHAVE_COMPRAS = '@caoprimido:compras';

export async function listarComprasDoRemedio(remedioId) {
  try {
    const json = localStorage.getItem(CHAVE_COMPRAS);
    const todas = json ? JSON.parse(json) : [];
    return todas
      .filter((c) => c.remedioId === remedioId)
      .sort((a, b) => b.data.localeCompare(a.data));
  } catch (e) {
    console.error('Erro ao listar compras', e);
    return [];
  }
}

export async function obterTodasCompras() {
  try {
    const json = localStorage.getItem(CHAVE_COMPRAS);
    return json ? JSON.parse(json) : [];
  } catch (e) {
    return [];
  }
}

async function salvarTodasCompras(lista) {
  localStorage.setItem(CHAVE_COMPRAS, JSON.stringify(lista));
}

export async function adicionarCompra(compra) {
  const todas = await obterTodasCompras();
  todas.push({ id: Date.now().toString(), ...compra });
  await salvarTodasCompras(todas);
  return listarComprasDoRemedio(compra.remedioId);
}

export async function atualizarCompra(id, dadosAtualizados) {
  const todas = await obterTodasCompras();
  const novaLista = todas.map((c) => (c.id === id ? { ...c, ...dadosAtualizados } : c));
  await salvarTodasCompras(novaLista);
  return listarComprasDoRemedio(dadosAtualizados.remedioId);
}

export async function removerCompra(id, remedioId) {
  const todas = await obterTodasCompras();
  const novaLista = todas.filter((c) => c.id !== id);
  await salvarTodasCompras(novaLista);
  return listarComprasDoRemedio(remedioId);
}
