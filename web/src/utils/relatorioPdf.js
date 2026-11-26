import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listarRemedios, obterRegistros } from './storage.js';
import { listarRegistrosSaude } from './saude.js';
import { calcularAdesaoPorRemedio, calcularAdesaoGeral } from './evolucao.js';
import { calcularSequenciaDias } from './streak.js';
import { obterPerfil } from './perfil.js';
import { entregarPdf } from './pdfSaida.js';
import { rotuloUnidade, descreverFrequencia, remedioEstaAtivo, formatarData, doseDoDia, formatarQuantidade, formatarDataBR, somarDias, calcularFasesComDatas } from './constantes.js';
import { listarConsultas } from './consultas.js';

// Paleta da marca (mesmos tons do app, em RGB pro jsPDF)
function obterPaletaPdf(modoBob) {
  if (modoBob) {
    return {
      PRIMARIA: [59, 125, 216], // #3B7DD8
      PRIMARIA_ESCURA: [44, 95, 168], // #2C5FA8
      DOURADO: [224, 169, 76],
      CREME: [217, 231, 250], // tom clarinho de azul, equivalente ao creme
      TEXTO_PRINCIPAL: [30, 58, 95], // #1E3A5F
      TEXTO_SECUNDARIO: [107, 133, 160], // #6B85A0
      BRANCO: [255, 255, 255],
    };
  }
  return {
    PRIMARIA: [217, 82, 122],
    PRIMARIA_ESCURA: [179, 61, 99],
    DOURADO: [224, 169, 76],
    CREME: [250, 243, 231],
    TEXTO_PRINCIPAL: [74, 46, 30],
    TEXTO_SECUNDARIO: [138, 111, 92],
    BRANCO: [255, 255, 255],
  };
}


// Acha a data mais antiga com uma dose confirmada pra um remédio específico
// — usado pra mostrar "desde quando" ele realmente começou a ser tomado
function primeiraDoseDoRemedio(remedioId, registros) {
  let maisAntiga = null;
  for (const chave in registros) {
    const [id, data] = chave.split('|');
    if (id !== remedioId) continue;
    if (!maisAntiga || data < maisAntiga) maisAntiga = data;
  }
  return maisAntiga;
}

function ultimaDoseDoRemedio(remedioId, registros) {
  let maisRecente = null;
  for (const chave in registros) {
    const [id, data] = chave.split('|');
    if (id !== remedioId) continue;
    if (!maisRecente || data > maisRecente) maisRecente = data;
  }
  return maisRecente;
}


// Carrega uma imagem do /public e devolve como data URL base64,
// pro jsPDF conseguir desenhar ela na página
function carregarImagemComoBase64(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}

// 88.7 -> "88,7" ; 90 -> "90" (vírgula, como no resto do app)
function formatarPesoKg(n) {
  return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

export async function gerarRelatorioPdf({ modoBob = false, compartilhar = false } = {}) {
  // abre a aba já aqui, ANTES de qualquer await — se abrir só depois de
  // esperar imagens/dados carregarem, o Safari/iOS bloqueia como popup
  // indesejado por não estar mais "dentro" do clique do usuário
  const janela = compartilhar ? null : window.open('', '_blank');

  const paleta = obterPaletaPdf(modoBob);
  const ROSA = paleta.PRIMARIA;
  const ROSA_ESCURO = paleta.PRIMARIA_ESCURA;
  const DOURADO = paleta.DOURADO;
  const CREME = paleta.CREME;
  const TEXTO_PRINCIPAL = paleta.TEXTO_PRINCIPAL;
  const TEXTO_SECUNDARIO = paleta.TEXTO_SECUNDARIO;
  const BRANCO = paleta.BRANCO;

  const remedios = await listarRemedios();
  const registros = await obterRegistros();
  const registrosSaude = await listarRegistrosSaude();
  const perfil = await obterPerfil();
  // consultas marcadas como "fora do relatório" não entram no PDF
  const consultas = (await listarConsultas()).filter((c) => !c.foraDoRelatorio);

  const adesaoGeral = calcularAdesaoGeral(remedios, registros, 84);
  const adesaoPorRemedio = calcularAdesaoPorRemedio(remedios, registros, 84);
  const sequenciaAtual = calcularSequenciaDias(remedios, registros);

  const pesoMaisRecente = [...registrosSaude]
    .filter((r) => r.peso != null)
    .sort((a, b) => b.data.localeCompare(a.data))[0] || null;

  const [logoBase64, mascoteBase64] = await Promise.all([
    carregarImagemComoBase64(modoBob ? '/logo-bob.png' : '/logo-caoprimido.png').catch(() => null),
    carregarImagemComoBase64(modoBob ? '/bob/mascote-lendo.png' : '/nina/mascote-lendo.png').catch(() => null),
  ]);

  const doc = new jsPDF();
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();

  // ---------- Cabeçalho colorido ----------
  const alturaCabecalho = 38;
  doc.setFillColor(...ROSA);
  doc.rect(0, 0, larguraPagina, alturaCabecalho, 'F');
  // uma faixa dourada fininha embaixo do cabeçalho, como um "sublinhado" de marca
  doc.setFillColor(...DOURADO);
  doc.rect(0, alturaCabecalho, larguraPagina, 1.5, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 14, 6, 26, 26);
  }

  doc.setFontSize(20);
  doc.setTextColor(...BRANCO);
  doc.setFont('helvetica', 'bold');
  doc.text('Cãoprimido', logoBase64 ? 46 : 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(255, 255, 255);
  const agora = new Date();
  doc.text(
    `Relatório gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    logoBase64 ? 46 : 14,
    28
  );

  let y = alturaCabecalho + 14;

  // ---------- Dados do paciente ----------
  const temDadosPessoais = perfil.nome || perfil.idade || perfil.altura || pesoMaisRecente;
  if (temDadosPessoais) {
    const partes = [];
    if (perfil.nome) partes.push(`Nome: ${perfil.nome}`);
    if (perfil.idade) partes.push(`Idade: ${perfil.idade} anos`);
    if (perfil.altura) partes.push(`Altura: ${perfil.altura} cm`);
    if (pesoMaisRecente) {
      partes.push(`Peso mais recente: ${formatarPesoKg(pesoMaisRecente.peso)} kg (${formatarDataBR(pesoMaisRecente.data)})`);
    }

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'normal');
    const textoCompleto = partes.join('   ·   ');
    const larguraTexto = larguraPagina - 28 - 10;
    const linhas = doc.splitTextToSize(textoCompleto, larguraTexto);
    const alturaCaixa = linhas.length * 5 + 6;

    doc.setFillColor(...CREME);
    doc.roundedRect(14, y, larguraPagina - 28, alturaCaixa, 2, 2, 'F');
    doc.setTextColor(...TEXTO_PRINCIPAL);
    doc.text(linhas, larguraPagina / 2, y + 6.5, { align: 'center' });
    y += alturaCaixa + 10;
  }

  // ---------- Cartões de resumo ----------
  const cartoes = [
    { rotulo: 'Adesão (12 semanas)', valor: adesaoGeral === null ? '—' : `${adesaoGeral}%` },
    { rotulo: 'Sequência atual', valor: `${sequenciaAtual} ${sequenciaAtual === 1 ? 'dia' : 'dias'}` },
    { rotulo: 'Remédios ativos', valor: `${remedios.filter((r) => remedioEstaAtivo(r, formatarData(new Date()))).length}` },
  ];
  const larguraCartao = (larguraPagina - 28 - 12) / 3; // 14mm de margem cada lado, 6mm de gap entre os 3
  cartoes.forEach((c, i) => {
    const x = 14 + i * (larguraCartao + 6);
    doc.setFillColor(...CREME);
    doc.roundedRect(x, y, larguraCartao, 22, 3, 3, 'F');
    doc.setFontSize(15);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...ROSA_ESCURO);
    doc.text(c.valor, x + larguraCartao / 2, y + 11, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(c.rotulo, x + larguraCartao / 2, y + 17, { align: 'center' });
  });
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...TEXTO_SECUNDARIO);
  const fimPeriodo = somarDias(formatarData(new Date()), -1);
  const inicioPeriodo = somarDias(formatarData(new Date()), -83);
  doc.text(`Adesão de ${formatarDataBR(inicioPeriodo)} a ${formatarDataBR(fimPeriodo)}. Doses puladas de propósito e o dia de hoje não entram no cálculo.`, 14, y + 22 + 5);
  y += 22 + 16;

  // ---------- Seção: Remédios ----------
  function tituloSecao(texto, yAtual) {
    doc.setFillColor(...ROSA);
    doc.rect(14, yAtual - 4.5, 3, 5, 'F'); // barrinha vertical de destaque
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXTO_PRINCIPAL);
    doc.text(texto, 20, yAtual);
    return yAtual + 6;
  }

  y = tituloSecao('Remédios cadastrados', y);

  const hojeStrRelatorio = formatarData(new Date());
  const remediosAtivos = remedios.filter((r) => remedioEstaAtivo(r, hojeStrRelatorio));
  const remediosParados = remedios.filter((r) => !remedioEstaAtivo(r, hojeStrRelatorio));

  function montarLinhaRemedio(r) {
    const adesao = adesaoPorRemedio.find((a) => a.id === r.id);
    const unidadeTexto = rotuloUnidade(r.unidade).toLowerCase();
    const primeiraDose = primeiraDoseDoRemedio(r.id, registros);
    return [
      r.nome,
      `${formatarQuantidade(doseDoDia(r, hojeStrRelatorio))} ${unidadeTexto}${Array.isArray(r.fases) && r.fases.length > 1 ? ' (atual)' : ''}`,
      descreverFrequencia(r.frequencia),
      (r.horarios || []).join(', '),
      primeiraDose ? formatarDataBR(primeiraDose) : '—',
      adesao ? `${adesao.percentual}%` : '—',
    ];
  }

  if (remediosAtivos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Remédio', 'Dose', 'Frequência', 'Horários', '1ª dose', 'Adesão']],
      body: remediosAtivos.map(montarLinhaRemedio),
      theme: 'plain',
      headStyles: {
        fillColor: ROSA,
        textColor: BRANCO,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 8, textColor: TEXTO_PRINCIPAL },
      alternateRowStyles: { fillColor: CREME },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 3.5 },
    });
    y = doc.lastAutoTable.finalY + 14;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text('Nenhum remédio ativo cadastrado.', 14, y);
    y += 14;
  }

  if (remediosParados.length > 0) {
    if (y > alturaPagina - 60) {
      doc.addPage();
      y = 20;
    }
    y = tituloSecao('Remédios parados', y);
    autoTable(doc, {
      startY: y,
      head: [['Remédio', 'Dose', 'Frequência', 'Horários', '1ª dose', 'Última dose']],
      body: remediosParados.map((r) => {
        const unidadeTexto = rotuloUnidade(r.unidade).toLowerCase();
        const primeiraDose = primeiraDoseDoRemedio(r.id, registros);
        const ultimaDose = ultimaDoseDoRemedio(r.id, registros);
        return [
          r.nome,
          `${formatarQuantidade(doseDoDia(r, hojeStrRelatorio))} ${unidadeTexto}`,
          descreverFrequencia(r.frequencia),
          (r.horarios || []).join(', '),
          primeiraDose ? formatarDataBR(primeiraDose) : '—',
          ultimaDose ? formatarDataBR(ultimaDose) : '—',
        ];
      }),
      theme: 'plain',
      headStyles: {
        fillColor: TEXTO_SECUNDARIO,
        textColor: BRANCO,
        fontStyle: 'bold',
        fontSize: 8.5,
      },
      bodyStyles: { fontSize: 8, textColor: TEXTO_PRINCIPAL },
      alternateRowStyles: { fillColor: CREME },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 3.5 },
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  // ---------- Seção: Detalhes dos remédios (esquema de dose, puladas, uso eventual) ----------
  const hojeRel = formatarData(new Date());
  const inicioJanela = somarDias(hojeRel, -83);
  const detalhes = [];
  for (const r of [...remediosAtivos, ...remediosParados]) {
    const linhas = [];
    if (Array.isArray(r.fases) && r.fases.length > 1 && r.dataInicio) {
      const partes = calcularFasesComDatas(r.fases, r.dataInicio).map((f) => {
        const dose = `${formatarQuantidade(f.quantidadePorDose)} ${rotuloUnidade(r.unidade).toLowerCase()}`;
        return f.fim ? `${dose} (${formatarDataBR(f.inicio)} a ${formatarDataBR(f.fim)})` : `${dose} (a partir de ${formatarDataBR(f.inicio)})`;
      });
      linhas.push(`Esquema de dose: ${partes.join('; depois ')}`);
    }
    const puladas = [];
    let usosEventuais = 0;
    for (const chave in registros) {
      const [id, data, horario] = chave.split('|');
      if (id !== r.id || data < inicioJanela || data > hojeRel) continue;
      if (registros[chave]?.pulada) puladas.push(registros[chave].motivo || '');
      else if (horario?.startsWith('prn-')) usosEventuais++;
    }
    if (puladas.length > 0) {
      const motivos = [...new Set(puladas.filter(Boolean))];
      linhas.push(`Doses puladas de propósito (12 semanas): ${puladas.length}${motivos.length ? ` — motivos: ${motivos.join(', ')}` : ''}`);
    }
    if (r.frequencia?.tipo === 'sob_demanda') {
      linhas.push(`Uso eventual: ${usosEventuais} ${usosEventuais === 1 ? 'vez' : 'vezes'} nas últimas 12 semanas`);
    }
    if (linhas.length > 0) detalhes.push([r.nome, linhas.join('\n')]);
  }

  if (detalhes.length > 0) {
    if (y > alturaPagina - 60) {
      doc.addPage();
      y = 20;
    }
    y = tituloSecao('Detalhes dos remédios', y);
    autoTable(doc, {
      startY: y,
      head: [['Remédio', 'Observações']],
      body: detalhes,
      theme: 'plain',
      headStyles: { fillColor: ROSA, textColor: BRANCO, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: TEXTO_PRINCIPAL },
      alternateRowStyles: { fillColor: CREME },
      columnStyles: { 0: { cellWidth: 38 } },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 3.5 },
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  // ---------- Seção: Consultas (próximas e dos últimos 90 dias) ----------
  const limitePassado = somarDias(hojeRel, -90);
  const proximas = consultas.filter((c) => c.data >= hojeRel).sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
  const recentes = consultas.filter((c) => c.data < hojeRel && c.data >= limitePassado).sort((a, b) => b.data.localeCompare(a.data));
  if (proximas.length + recentes.length > 0) {
    if (y > alturaPagina - 60) {
      doc.addPage();
      y = 20;
    }
    y = tituloSecao('Consultas', y);
    autoTable(doc, {
      startY: y,
      head: [['Situação', 'Data', 'Hora', 'Médico / especialidade', 'Local', 'Anotações']],
      body: [...proximas.map((c) => ['Próxima', c]), ...recentes.map((c) => ['Realizada', c])].map(([situacao, c]) => [
        situacao,
        formatarDataBR(c.data),
        c.hora || '—',
        c.medico,
        c.local || '—',
        c.anotacoes || '—',
      ]),
      theme: 'plain',
      headStyles: { fillColor: ROSA, textColor: BRANCO, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8, textColor: TEXTO_PRINCIPAL },
      alternateRowStyles: { fillColor: CREME },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 3.5 },
    });
    y = doc.lastAutoTable.finalY + 14;
  }

  // ---------- Seção: Saúde ----------
  if (y > alturaPagina - 60) {
    doc.addPage();
    y = 20;
  }

  y = tituloSecao('Registros de saúde', y);

  if (registrosSaude.length > 0) {
    // variação do peso entre o primeiro e o último registro
    const comPeso = registrosSaude.filter((r) => r.peso != null).sort((a, b) => a.data.localeCompare(b.data));
    if (comPeso.length >= 2) {
      const primeiro = comPeso[0];
      const ultimo = comPeso[comPeso.length - 1];
      const diff = Math.round((ultimo.peso - primeiro.peso) * 100) / 100;
      const sinal = diff > 0 ? '+' : diff < 0 ? '-' : '';
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...TEXTO_PRINCIPAL);
      doc.text(
        diff === 0
          ? `Peso estável entre ${formatarDataBR(primeiro.data)} e ${formatarDataBR(ultimo.data)} (${formatarPesoKg(ultimo.peso)} kg)`
          : `Variação do peso: ${sinal}${formatarPesoKg(Math.abs(diff))} kg entre ${formatarDataBR(primeiro.data)} e ${formatarDataBR(ultimo.data)} (de ${formatarPesoKg(primeiro.peso)} para ${formatarPesoKg(ultimo.peso)} kg)`,
        14,
        y
      );
      doc.setFont('helvetica', 'normal');
      y += 5;
    }
    const ordenados = [...registrosSaude].sort((a, b) => b.data.localeCompare(a.data));
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Peso', 'Pressão', 'Freq. cardíaca', 'Anotações']],
      body: ordenados.map((r) => [
        formatarDataBR(r.data),
        r.peso != null ? `${formatarPesoKg(r.peso)} kg` : '—',
        r.pressaoSistolica != null ? `${r.pressaoSistolica}/${r.pressaoDiastolica || '—'} mmHg` : '—',
        r.frequenciaCardiaca != null ? `${r.frequenciaCardiaca} bpm` : '—',
        r.anotacoes || '—',
      ]),
      theme: 'plain',
      headStyles: {
        fillColor: ROSA,
        textColor: BRANCO,
        fontStyle: 'bold',
        fontSize: 9.5,
      },
      bodyStyles: { fontSize: 9, textColor: TEXTO_PRINCIPAL },
      alternateRowStyles: { fillColor: CREME },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 4 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text('Nenhum registro de saúde ainda.', 14, y);
  }

  // ---------- Rodapé em todas as páginas ----------
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);

    // linha dourada fininha separando o rodapé
    doc.setDrawColor(...DOURADO);
    doc.setLineWidth(0.5);
    doc.line(14, alturaPagina - 18, larguraPagina - 14, alturaPagina - 18);

    if (mascoteBase64 && i === totalPaginas) {
      doc.addImage(mascoteBase64, 'PNG', larguraPagina - 26, alturaPagina - 16, 12, 12);
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(
      'Gerado pelo app Cãoprimido — não substitui orientação médica profissional.',
      14,
      alturaPagina - 11
    );
    doc.text(`Página ${i} de ${totalPaginas}`, 14, alturaPagina - 6);
  }

  await entregarPdf(doc, janela, 'caoprimido-relatorio.pdf', compartilhar);
}
