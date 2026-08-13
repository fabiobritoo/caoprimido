import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listarRemedios } from './storage.js';
import { obterTodasCompras } from './compras.js';
import { rotuloUnidade } from './constantes.js';

function obterPaletaPdf(modoBob) {
  if (modoBob) {
    return {
      PRIMARIA: [59, 125, 216],
      PRIMARIA_ESCURA: [44, 95, 168],
      DOURADO: [224, 169, 76],
      CREME: [217, 231, 250],
      TEXTO_PRINCIPAL: [30, 58, 95],
      TEXTO_SECUNDARIO: [107, 133, 160],
      BRANCO: [255, 255, 255],
      SUCESSO: [76, 154, 92],
      PERIGO: [196, 78, 74],
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
    SUCESSO: [76, 154, 92],
    PERIGO: [196, 78, 74],
  };
}

function formatarDataExtenso(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Calcula a média de doses por dia considerando a frequência real do
// remédio — sem isso, um remédio "1x por semana" seria calculado como se
// fosse tomado todo santo dia, inflando o custo estimado em até 7x
function calcularMediaDosesPorDia(remedio) {
  const horariosPorDia = remedio.horarios?.length || 1;
  const freq = remedio.frequencia;

  if (!freq || freq.tipo === 'diaria') {
    return horariosPorDia;
  }
  if (freq.tipo === 'dias_semana') {
    const diasPorSemana = freq.dias?.length || 7;
    return (horariosPorDia * diasPorSemana) / 7;
  }
  if (freq.tipo === 'intervalo') {
    const intervalo = freq.intervaloDias || 1;
    return horariosPorDia / intervalo;
  }
  return horariosPorDia;
}

function descreverFrequenciaResumo(remedio) {
  const freq = remedio.frequencia;
  const horariosPorDia = remedio.horarios?.length || 1;
  const sufixoHorarios = ` · ${horariosPorDia}x ao dia`;

  if (!freq || freq.tipo === 'diaria') return `todos os dias${sufixoHorarios}`;
  if (freq.tipo === 'dias_semana') {
    const n = freq.dias?.length || 0;
    const diasTexto = n === 1 ? '1x por semana' : `${n}x por semana`;
    return `${diasTexto}${sufixoHorarios}`;
  }
  if (freq.tipo === 'intervalo') {
    return `a cada ${freq.intervaloDias || 1} dias${sufixoHorarios}`;
  }
  return '';
}

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

export async function gerarRelatorioPrecoPdf({ modoBob = false } = {}) {
  const paleta = obterPaletaPdf(modoBob);
  const { PRIMARIA, PRIMARIA_ESCURA, DOURADO, CREME, TEXTO_PRINCIPAL, TEXTO_SECUNDARIO, BRANCO, SUCESSO, PERIGO } =
    paleta;

  const remedios = await listarRemedios();
  const todasCompras = await obterTodasCompras();

  const [logoBase64, mascoteBase64] = await Promise.all([
    carregarImagemComoBase64(modoBob ? '/logo-bob.png' : '/logo-caoprimido.png').catch(() => null),
    carregarImagemComoBase64(modoBob ? '/bob/mascote-lendo.png' : '/nina/mascote-lendo.png').catch(() => null),
  ]);

  const comprasPorRemedio = {};
  for (const remedio of remedios) {
    const doRemedio = todasCompras
      .filter((c) => c.remedioId === remedio.id)
      .sort((a, b) => a.data.localeCompare(b.data));
    if (doRemedio.length > 0) comprasPorRemedio[remedio.id] = doRemedio;
  }

  const remediosComPreco = remedios.filter((r) => comprasPorRemedio[r.id]);

  const doc = new jsPDF();
  const larguraPagina = doc.internal.pageSize.getWidth();
  const alturaPagina = doc.internal.pageSize.getHeight();

  const alturaCabecalho = 38;
  doc.setFillColor(...PRIMARIA);
  doc.rect(0, 0, larguraPagina, alturaCabecalho, 'F');
  doc.setFillColor(...DOURADO);
  doc.rect(0, alturaCabecalho, larguraPagina, 1.5, 'F');

  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 14, 6, 26, 26);
  }

  doc.setFontSize(20);
  doc.setTextColor(...BRANCO);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Preços', logoBase64 ? 46 : 14, 20);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const agora = new Date();
  doc.text(
    `Cãoprimido · Gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    logoBase64 ? 46 : 14,
    28
  );

  let y = alturaCabecalho + 14;

  if (remediosComPreco.length === 0) {
    doc.setFontSize(12);
    doc.setTextColor(...TEXTO_PRINCIPAL);
    doc.text('Nenhum registro de preço/compra cadastrado ainda.', larguraPagina / 2, y + 10, {
      align: 'center',
    });
    doc.save('caoprimido-relatorio-precos.pdf');
    return;
  }

  const metricasPorRemedio = remediosComPreco.map((remedio) => {
    const compras = comprasPorRemedio[remedio.id];
    const maisRecente = compras[compras.length - 1];
    const primeira = compras[0];

    const precos = compras.map((c) => c.preco);
    const precoMedio = precos.reduce((a, b) => a + b, 0) / precos.length;
    const precoMinimo = Math.min(...precos);
    const precoMaximo = Math.max(...precos);

    const variacaoDesdeInicio =
      compras.length > 1 ? ((maisRecente.preco - primeira.preco) / primeira.preco) * 100 : null;

    let custoDiarioEstimado = null;
    if (maisRecente.quantidade > 0) {
      const precoPorUnidade = maisRecente.preco / maisRecente.quantidade;
      const mediaDosesPorDia = calcularMediaDosesPorDia(remedio);
      custoDiarioEstimado = precoPorUnidade * (remedio.quantidadePorDose || 1) * mediaDosesPorDia;
    }

    const locais = [...new Set(compras.filter((c) => c.local).map((c) => c.local))];
    let localMaisBarato = null;
    if (locais.length > 1) {
      const compraMaisBarata = compras.reduce((menor, c) => (c.preco < menor.preco ? c : menor));
      localMaisBarato = compraMaisBarata.local;
    }

    return {
      remedio,
      compras,
      maisRecente,
      precoMedio,
      precoMinimo,
      precoMaximo,
      variacaoDesdeInicio,
      custoDiarioEstimado,
      localMaisBarato,
    };
  });

  const gastoRecente = metricasPorRemedio.reduce((soma, m) => soma + m.maisRecente.preco, 0);
  const custoDiarioTotal = metricasPorRemedio.reduce((soma, m) => soma + (m.custoDiarioEstimado || 0), 0);

  const cartoes = [
    { rotulo: 'Gasto na última compra de cada', valor: formatarPreco(gastoRecente) },
    { rotulo: 'Custo diário estimado', valor: formatarPreco(custoDiarioTotal) },
    { rotulo: 'Custo mensal estimado (×30)', valor: formatarPreco(custoDiarioTotal * 30) },
  ];
  const larguraCartao = (larguraPagina - 28 - 12) / 3;
  cartoes.forEach((c, i) => {
    const x = 14 + i * (larguraCartao + 6);
    doc.setFillColor(...CREME);
    doc.roundedRect(x, y, larguraCartao, 26, 3, 3, 'F');
    doc.setFontSize(12.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARIA_ESCURA);
    doc.text(c.valor, x + larguraCartao / 2, y + 12, { align: 'center' });
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(c.rotulo, x + larguraCartao / 2, y + 19, { align: 'center', maxWidth: larguraCartao - 6 });
  });
  y += 26 + 8;

  doc.setFontSize(8);
  doc.setTextColor(...TEXTO_SECUNDARIO);
  doc.setFont('helvetica', 'italic');
  const textoExplicativo =
    'Custo diário/mensal considera o preço mais recente por unidade × quantidade por dose × doses por dia (conta os horários cadastrados, ex: 3 horários = 3x ao dia) × a frequência real (todos os dias, X vezes por semana, ou a cada X dias) — não assume uso diário pra remédios ocasionais.';
  const linhasExplicacao = doc.splitTextToSize(textoExplicativo, larguraPagina - 28);
  doc.text(linhasExplicacao, 14, y);
  y += linhasExplicacao.length * 3.6 + 8;

  for (const m of metricasPorRemedio) {
    const { remedio, compras, maisRecente, precoMedio, precoMinimo, precoMaximo, variacaoDesdeInicio } = m;

    if (y > alturaPagina - 65) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...PRIMARIA);
    doc.rect(14, y - 4.5, 3, 5, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXTO_PRINCIPAL);
    doc.text(remedio.nome, 20, y);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(`Mais recente: ${formatarPreco(maisRecente.preco)}`, larguraPagina - 14, y, { align: 'right' });
    y += 7;

    const metricasTexto = [
      `Médio: ${formatarPreco(precoMedio)}`,
      `Mín: ${formatarPreco(precoMinimo)}`,
      `Máx: ${formatarPreco(precoMaximo)}`,
    ];
    if (m.custoDiarioEstimado != null) {
      metricasTexto.push(`Custo/dia: ${formatarPreco(m.custoDiarioEstimado)} (${descreverFrequenciaResumo(remedio)})`);
    }
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(metricasTexto.join('   ·   '), 14, y);
    y += 6;

    if (variacaoDesdeInicio != null && Math.abs(variacaoDesdeInicio) >= 0.5) {
      const subiu = variacaoDesdeInicio > 0;
      doc.setTextColor(...(subiu ? PERIGO : SUCESSO));
      doc.setFont('helvetica', 'bold');
      doc.text(
        `${subiu ? '▲' : '▼'} ${subiu ? '+' : ''}${variacaoDesdeInicio.toFixed(1)}% desde a primeira compra registrada`,
        14,
        y
      );
      y += 6;
    }

    if (m.localMaisBarato) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXTO_SECUNDARIO);
      doc.text(`Local mais barato encontrado: ${m.localMaisBarato}`, 14, y);
      y += 6;
    }

    y += 2;

    const ultimasTres = compras.slice(-3).reverse();
    autoTable(doc, {
      startY: y,
      head: [['Data', 'Preço', 'Local', 'Qtd', 'Anotações']],
      body: ultimasTres.map((c) => [
        formatarDataExtenso(c.data),
        formatarPreco(c.preco),
        c.local || '—',
        c.quantidade != null ? `${c.quantidade} ${rotuloUnidade(remedio.unidade).toLowerCase()}` : '—',
        c.anotacoes || '—',
      ]),
      theme: 'plain',
      headStyles: { fillColor: PRIMARIA, textColor: BRANCO, fontStyle: 'bold', fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5, textColor: TEXTO_PRINCIPAL },
      alternateRowStyles: { fillColor: CREME },
      margin: { left: 14, right: 14 },
      styles: { cellPadding: 3 },
    });

    y = doc.lastAutoTable.finalY;
    if (compras.length > 3) {
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...TEXTO_SECUNDARIO);
      doc.text(`+ ${compras.length - 3} compra(s) mais antiga(s) não exibida(s).`, 14, y + 5);
      y += 5;
    }
    y += 14;
  }

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(...DOURADO);
    doc.setLineWidth(0.5);
    doc.line(14, alturaPagina - 18, larguraPagina - 14, alturaPagina - 18);

    if (mascoteBase64 && i === totalPaginas) {
      doc.addImage(mascoteBase64, 'PNG', larguraPagina - 26, alturaPagina - 16, 12, 12);
    }

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text('Gerado pelo app Cãoprimido.', 14, alturaPagina - 11);
    doc.text(`Página ${i} de ${totalPaginas}`, 14, alturaPagina - 6);
  }

  const dataArquivo = agora.toISOString().slice(0, 10);
  doc.save(`caoprimido-relatorio-precos-${dataArquivo}.pdf`);
}
