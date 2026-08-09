const CHAVE_SAUDE = '@caoprimido:saude';

export async function listarRegistrosSaude() {
  try {
    const json = localStorage.getItem(CHAVE_SAUDE);
    const lista = json ? JSON.parse(json) : [];
    return lista.sort((a, b) => b.data.localeCompare(a.data));
  } catch (e) {
    console.error('Erro ao listar registros de saúde', e);
    return [];
  }
}

async function salvarRegistrosSaude(lista) {
  localStorage.setItem(CHAVE_SAUDE, JSON.stringify(lista));
}

export async function adicionarRegistroSaude(registro) {
  const lista = await listarRegistrosSaude();
  const novo = { id: Date.now().toString(), ...registro };
  lista.push(novo);
  await salvarRegistrosSaude(lista);
  return lista.sort((a, b) => b.data.localeCompare(a.data));
}

export async function removerRegistroSaude(id) {
  const lista = await listarRegistrosSaude();
  const novaLista = lista.filter((r) => r.id !== id);
  await salvarRegistrosSaude(novaLista);
  return novaLista;
}
