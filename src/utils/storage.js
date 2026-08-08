import AsyncStorage from '@react-native-async-storage/async-storage';

const CHAVE_REMEDIOS = '@remedios_app:lista';

// Estrutura de um remédio:
// {
//   id: string,
//   nome: string,
//   dosagem: string,          // ex: "1 comprimido"
//   horarios: ['08:00', '20:00'],
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
