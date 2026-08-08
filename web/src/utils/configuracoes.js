const CHAVE_CONFIG = '@caoprimido:config';

export async function obterConfiguracoes() {
  try {
    const json = localStorage.getItem(CHAVE_CONFIG);
    return json
      ? JSON.parse(json)
      : { cuidadorAtivo: false, cuidadorTelefone: '', cuidadorApiKey: '' };
  } catch (e) {
    return { cuidadorAtivo: false, cuidadorTelefone: '', cuidadorApiKey: '' };
  }
}

export async function salvarConfiguracoes(config) {
  localStorage.setItem(CHAVE_CONFIG, JSON.stringify(config));
}
