import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listarRemedios, obterRegistros } from './storage.js';
import { listarRegistrosSaude } from './saude.js';
import { calcularAdesaoPorRemedio, calcularAdesaoGeral } from './evolucao.js';
import { calcularSequenciaDias } from './streak.js';
import { obterPerfil } from './perfil.js';
import { rotuloUnidade, descreverFrequencia } from './constantes.js';

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

function formatarDataExtenso(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarNomeArquivo(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
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

export async function gerarRelatorioPdf({ modoBob = false } = {}) {
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
      partes.push(`Peso mais recente: ${pesoMaisRecente.peso} kg (${formatarDataExtenso(pesoMaisRecente.data)})`);
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
    { rotulo: 'Adesão geral', valor: adesaoGeral === null ? '—' : `${adesaoGeral}%` },
    { rotulo: 'Sequência atual', valor: `${sequenciaAtual} ${sequenciaAtual === 1 ? 'dia' : 'dias'}` },
    { rotulo: 'Remédios ativos', valor: `${remedios.length}` },
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
  y += 22 + 14;

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

  if (remedios.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Remédio', 'Dose', 'Frequência', 'Horários', 'Adesão']],
      body: remedios.map((r) => {
        const adesao = adesaoPorRemedio.find((a) => a.nome === r.nome);
        const unidadeTexto = rotuloUnidade(r.unidade).toLowerCase();
        return [
          r.nome,
          `${r.quantidadePorDose} ${unidadeTexto}`,
          descreverFrequencia(r.frequencia),
          (r.horarios || []).join(', '),
          adesao ? `${adesao.percentual}%` : '—',
        ];
      }),
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
    y = doc.lastAutoTable.finalY + 14;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text('Nenhum remédio cadastrado.', 14, y);
    y += 14;
  }

  // ---------- Seção: Saúde ----------
  if (y > alturaPagina - 60) {
    doc.addPage();
    y = 20;
  }

  y = tituloSecao('Registros de saúde', y);

  if (registrosSaude.length > 0) {
    const ordenados = [...registrosSaude].sort((a, b) => a.data.localeCompare(b.data));
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Peso', 'Pressão', 'Freq. cardíaca', 'Anotações']],
      body: ordenados.map((r) => [
        formatarDataExtenso(r.data),
        r.peso != null ? `${r.peso} kg` : '—',
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

  doc.save(`caoprimido-relatorio-${formatarNomeArquivo(agora)}.pdf`);
}
