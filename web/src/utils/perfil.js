const CHAVE_PERFIL = '@caoprimido:perfil';

export async function obterPerfil() {
  try {
    const json = localStorage.getItem(CHAVE_PERFIL);
    return json ? JSON.parse(json) : { nome: '', idade: '', altura: '' };
  } catch (e) {
    console.error('Erro ao ler perfil', e);
    return { nome: '', idade: '', altura: '' };
  }
}

export async function salvarPerfil(perfil) {
  localStorage.setItem(CHAVE_PERFIL, JSON.stringify(perfil));
}
