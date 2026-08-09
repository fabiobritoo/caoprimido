const CHAVE_CONSULTAS = '@caoprimido:consultas';

export async function listarConsultas() {
  try {
    const json = localStorage.getItem(CHAVE_CONSULTAS);
    const lista = json ? JSON.parse(json) : [];
    return lista.sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
  } catch (e) {
    console.error('Erro ao listar consultas', e);
    return [];
  }
}

async function salvarConsultas(lista) {
  localStorage.setItem(CHAVE_CONSULTAS, JSON.stringify(lista));
}

export async function adicionarConsulta(consulta) {
  const lista = await listarConsultas();
  lista.push({ id: Date.now().toString(), ...consulta });
  await salvarConsultas(lista);
  return listarConsultas();
}

export async function removerConsulta(id) {
  const lista = await listarConsultas();
  const novaLista = lista.filter((c) => c.id !== id);
  await salvarConsultas(novaLista);
  return novaLista;
}

// Devolve a próxima consulta futura (data/hora >= agora), ou null
export async function obterProximaConsulta() {
  const lista = await listarConsultas();
  const agora = new Date();
  const futuras = lista.filter((c) => {
    const dataHora = new Date(`${c.data}T${c.hora || '23:59'}:00`);
    return dataHora >= agora;
  });
  return futuras[0] || null;
}
