// As cores de destaque (rosa, dourado, sucesso, atenção, perigo) ficam
// praticamente iguais nas duas paletas — é o que dá identidade ao app.
// O que muda entre claro/escuro é fundo, cartões, texto e bordas.

export const CORES_CLARO = {
  primaria: '#D9527A',
  primariaEscura: '#B33D63',
  primariaClara: '#F6D3DF',
  dourado: '#E0A94C',
  fundo: '#FAF3E7',
  fundoCard: '#FFFFFF',
  sucesso: '#6FBF73',
  sucessoFundo: '#EDF7EE',
  atencao: '#F0A63A',
  perigo: '#D9534F',
  perigoFundo: '#FBEAEA',
  textoPrincipal: '#4A2E1E',
  textoSecundario: '#8A6F5C',
  borda: '#EEDFCB',
};

export const CORES_ESCURO = {
  primaria: '#E37096',
  primariaEscura: '#F5A8C0',
  primariaClara: '#3D2A32',
  dourado: '#E0A94C',
  fundo: '#181210',
  fundoCard: '#241C19',
  sucesso: '#7FCB82',
  sucessoFundo: '#1E3320',
  atencao: '#F0B85C',
  perigo: '#E7807A',
  perigoFundo: '#3A2222',
  textoPrincipal: '#F3E9DF',
  textoSecundario: '#B3A093',
  borda: '#392E27',
};

// Paleta do "Modo Bob" — tons de azul, pro outro cachorro da família
export const CORES_CLARO_BOB = {
  primaria: '#3B7DD8',
  primariaEscura: '#2C5FA8',
  primariaClara: '#D9E7FA',
  dourado: '#E0A94C',
  fundo: '#EFF4F9',
  fundoCard: '#FFFFFF',
  sucesso: '#6FBF73',
  sucessoFundo: '#E8F5E9',
  atencao: '#F0A63A',
  perigo: '#D9534F',
  perigoFundo: '#FBEAEA',
  textoPrincipal: '#1E3A5F',
  textoSecundario: '#6B85A0',
  borda: '#D3E2F0',
};

export const CORES_ESCURO_BOB = {
  primaria: '#5B9BE0',
  primariaEscura: '#8AC0F0',
  primariaClara: '#1E3550',
  dourado: '#E0A94C',
  fundo: '#0F1720',
  fundoCard: '#1A2530',
  sucesso: '#7FCB82',
  sucessoFundo: '#1B2E20',
  atencao: '#F0B85C',
  perigo: '#E7807A',
  perigoFundo: '#332020',
  textoPrincipal: '#E5EEF7',
  textoSecundario: '#93A8BE',
  borda: '#26374A',
};

// Tokens reutilizáveis (iguais nas duas paletas)
export const RAIO = {
  pequeno: 10,
  medio: 16,
  grande: 20,
  pill: 999,
};

export const SOMBRA = {
  card: '0 2px 10px rgba(0, 0, 0, 0.08)',
  botao: '0 3px 10px rgba(217, 82, 122, 0.35)',
  flutuante: '0 6px 18px rgba(0, 0, 0, 0.22)',
};

export function criarBotaoPrimario(CORES) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CORES.primaria,
    color: '#fff',
    border: 'none',
    borderRadius: RAIO.medio,
    padding: '15px 20px',
    fontWeight: 700,
    fontSize: 16,
    boxShadow: SOMBRA.botao,
  };
}

export function criarBotaoSecundario(CORES) {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CORES.fundoCard,
    color: CORES.primaria,
    border: `1.5px solid ${CORES.primaria}`,
    borderRadius: RAIO.medio,
    padding: '13px 20px',
    fontWeight: 600,
    fontSize: 15,
  };
}
