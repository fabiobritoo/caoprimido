let audioContext = null;
let intervaloLatido = null;

// Gera um buffer de ruído branco curto (textura "áspera" do latido)
function criarRuidoBuffer(duracaoSegundos) {
  const tamanho = Math.floor(audioContext.sampleRate * duracaoSegundos);
  const buffer = audioContext.createBuffer(1, tamanho, audioContext.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i++) {
    dados[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Um único "au": tom grave descendente (a "voz") + ruído filtrado (a "aspereza")
function tocarUmLatido(atrasoSegundos) {
  const inicio = audioContext.currentTime + atrasoSegundos;

  // tom principal — começa agudo e cai rápido, como um latido de verdade
  const oscilador = audioContext.createOscillator();
  oscilador.type = 'sawtooth';
  oscilador.frequency.setValueAtTime(750, inicio);
  oscilador.frequency.exponentialRampToValueAtTime(140, inicio + 0.13);

  const ganhoTom = audioContext.createGain();
  ganhoTom.gain.setValueAtTime(0.0001, inicio);
  ganhoTom.gain.exponentialRampToValueAtTime(0.5, inicio + 0.02);
  ganhoTom.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.2);

  oscilador.connect(ganhoTom);
  ganhoTom.connect(audioContext.destination);
  oscilador.start(inicio);
  oscilador.stop(inicio + 0.22);

  // ruído filtrado — dá a textura "rouca" que faz soar mais com latido e menos com apito
  const fonteRuido = audioContext.createBufferSource();
  fonteRuido.buffer = criarRuidoBuffer(0.16);

  const filtro = audioContext.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.setValueAtTime(500, inicio);
  filtro.Q.value = 0.6;

  const ganhoRuido = audioContext.createGain();
  ganhoRuido.gain.setValueAtTime(0.0001, inicio);
  ganhoRuido.gain.exponentialRampToValueAtTime(0.3, inicio + 0.015);
  ganhoRuido.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.15);

  fonteRuido.connect(filtro);
  filtro.connect(ganhoRuido);
  ganhoRuido.connect(audioContext.destination);
  fonteRuido.start(inicio);
  fonteRuido.stop(inicio + 0.16);
}

// Dois latidos rápidos em sequência — "au au!" — como um cachorro alertando
function tocarLatidoDuplo() {
  if (!audioContext) return;
  tocarUmLatido(0);
  tocarUmLatido(0.16);
}

export function iniciarAlarme() {
  if (intervaloLatido) return; // já está tocando

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
