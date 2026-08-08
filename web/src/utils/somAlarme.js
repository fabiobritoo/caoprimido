let audioContext = null;
let intervaloBeep = null;

function tocarBeep() {
  if (!audioContext) return;
  const oscilador = audioContext.createOscillator();
  const ganho = audioContext.createGain();

  oscilador.type = 'square';
  oscilador.frequency.setValueAtTime(880, audioContext.currentTime);

  ganho.gain.setValueAtTime(0.35, audioContext.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.35);

  oscilador.connect(ganho);
  ganho.connect(audioContext.destination);

  oscilador.start();
  oscilador.stop(audioContext.currentTime + 0.35);
}

export function iniciarAlarme() {
  if (intervaloBeep) return; // já está tocando

  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  tocarBeep();
  intervaloBeep = setInterval(tocarBeep, 700);
}

export function pararAlarme() {
  if (intervaloBeep) {
    clearInterval(intervaloBeep);
    intervaloBeep = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (navigator.vibrate) navigator.vibrate(0);
}
