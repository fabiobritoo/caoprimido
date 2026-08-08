export const CORES = {
  primaria: '#D9527A',
  primariaEscura: '#B33D63',
  primariaClara: '#F6D3DF',
  dourado: '#E0A94C',
  fundo: '#FAF3E7',
  fundoCard: '#FFFFFF',
  sucesso: '#6FBF73',
  atencao: '#F0A63A',
  perigo: '#D9534F',
  textoPrincipal: '#4A2E1E',
  textoSecundario: '#8A6F5C',
  borda: '#EEDFCB',
};

// Tokens reutilizáveis pra manter os botões/cards consistentes em todas as telas
export const RAIO = {
  pequeno: 10,
  medio: 16,
  grande: 20,
  pill: 999,
};

export const SOMBRA = {
  card: '0 2px 10px rgba(74, 46, 30, 0.06)',
  botao: '0 3px 10px rgba(217, 82, 122, 0.35)',
  flutuante: '0 6px 18px rgba(74, 46, 30, 0.18)',
};

export const botaoPrimario = {
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

export const botaoSecundario = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  backgroundColor: '#fff',
  color: CORES.primaria,
  border: `1.5px solid ${CORES.primaria}`,
  borderRadius: RAIO.medio,
  padding: '13px 20px',
  fontWeight: 600,
  fontSize: 15,
};
