let audioContext = null;
let intervaloLatido = null;

// Gera um buffer de ruído branco curto (textura "áspera")
function criarRuidoBuffer(duracaoSegundos) {
  const tamanho = Math.floor(audioContext.sampleRate * duracaoSegundos);
  const buffer = audioContext.createBuffer(1, tamanho, audioContext.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i++) {
    dados[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Um único "au": três osciladores levemente desafinados (dá o "grosso" da voz),
// passando por um filtro que fecha rápido (imita a boca fechando), mais um
// estalo de ruído bem no início (o "clique" do latido começando).
function tocarUmLatido(atrasoSegundos) {
  const inicio = audioContext.currentTime + atrasoSegundos;
  const duracao = 0.15;

  const ganhoGeral = audioContext.createGain();
  ganhoGeral.gain.setValueAtTime(0.0001, inicio);
  ganhoGeral.gain.exponentialRampToValueAtTime(0.55, inicio + 0.008); // ataque bem rápido, tipo estalo
  ganhoGeral.gain.exponentialRampToValueAtTime(0.0001, inicio + duracao);

  const filtro = audioContext.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.setValueAtTime(4500, inicio);
  filtro.frequency.exponentialRampToValueAtTime(280, inicio + duracao); // "fecha" rápido
  filtro.Q.value = 1.3;

  filtro.connect(ganhoGeral);
  ganhoGeral.connect(audioContext.destination);

  // três osciladores desafinados entre si = textura "rouca", não um apito limpo
  const desafinacoes = [0, -6, 7];
  desafinacoes.forEach((desafinacaoCents) => {
    const osc = audioContext.createOscillator();
    osc.type = 'sawtooth';
    const fator = Math.pow(2, desafinacaoCents / 1200);
    osc.frequency.setValueAtTime(750 * fator, inicio);
    osc.frequency.exponentialRampToValueAtTime(140 * fator, inicio + 0.13);
    osc.connect(filtro);
    osc.start(inicio);
    osc.stop(inicio + duracao + 0.02);
  });

  // estalo de ruído no ataque — simula a "explosão" de ar do latido começando
  const fonteRuido = audioContext.createBufferSource();
  fonteRuido.buffer = criarRuidoBuffer(0.04);
  const ganhoRuido = audioContext.createGain();
  ganhoRuido.gain.setValueAtTime(0.35, inicio);
  ganhoRuido.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.04);
  fonteRuido.connect(ganhoRuido);
  ganhoRuido.connect(audioContext.destination);
  fonteRuido.start(inicio);
  fonteRuido.stop(inicio + 0.04);
}

// Dois latidos rápidos em sequência — "au au!"
function tocarLatidoDuplo() {
  if (!audioContext) return;
  tocarUmLatido(0);
  tocarUmLatido(0.16);
}

export function iniciarAlarme() {
  if (intervaloLatido) return;

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  tocarLatidoDuplo();
  intervaloLatido = setInterval(tocarLatidoDuplo, 900);
}

export function pararAlarme() {
  if (intervaloLatido) {
    clearInterval(intervaloLatido);
    intervaloLatido = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (navigator.vibrate) navigator.vibrate(0);
}
