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

function formatarPreco(valor) {
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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
  const { PRIMARIA, PRIMARIA_ESCURA, DOURADO, CREME, TEXTO_PRINCIPAL, TEXTO_SECUNDARIO, BRANCO } = paleta;

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

  let gastoTotal = 0;
  let custoDiarioTotal = 0;
  for (const remedio of remediosComPreco) {
    const compras = comprasPorRemedio[remedio.id];
    gastoTotal += compras.reduce((soma, c) => soma + c.preco, 0);

    const comQuantidade = compras.filter((c) => c.quantidade > 0);
    if (comQuantidade.length > 0) {
      const precoMedioUnidade =
        comQuantidade.reduce((soma, c) => soma + c.preco / c.quantidade, 0) / comQuantidade.length;
      const dosesPorDia = remedio.horarios?.length || 1;
      custoDiarioTotal += precoMedioUnidade * (remedio.quantidadePorDose || 1) * dosesPorDia;
    }
  }

  const cartoes = [
    { rotulo: 'Gasto total registrado', valor: formatarPreco(gastoTotal) },
    { rotulo: 'Custo diário estimado', valor: formatarPreco(custoDiarioTotal) },
    { rotulo: 'Remédios com preço', valor: `${remediosComPreco.length}` },
  ];
  const larguraCartao = (larguraPagina - 28 - 12) / 3;
  cartoes.forEach((c, i) => {
    const x = 14 + i * (larguraCartao + 6);
    doc.setFillColor(...CREME);
    doc.roundedRect(x, y, larguraCartao, 24, 3, 3, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PRIMARIA_ESCURA);
    doc.text(c.valor, x + larguraCartao / 2, y + 12, { align: 'center' });
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(c.rotulo, x + larguraCartao / 2, y + 19, { align: 'center' });
  });
  y += 24 + 8;

  doc.setFontSize(8);
  doc.setTextColor(...TEXTO_SECUNDARIO);
  doc.setFont('helvetica', 'italic');
  doc.text(
    'Custo diário estimado considera o preço médio por unidade × dose × horários cadastrados, só para remédios com quantidade informada nas compras.',
    14,
    y,
    { maxWidth: larguraPagina - 28 }
  );
  y += 14;

  for (const remedio of remediosComPreco) {
    const compras = comprasPorRemedio[remedio.id];

    if (y > alturaPagina - 70) {
      doc.addPage();
      y = 20;
    }

    doc.setFillColor(...PRIMARIA);
    doc.rect(14, y - 4.5, 3, 5, 'F');
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXTO_PRINCIPAL);
    doc.text(remedio.nome, 20, y);

    const precoMaisRecente = compras[compras.length - 1].preco;
    const precoMedio = compras.reduce((soma, c) => soma + c.preco, 0) / compras.length;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(
      `Preço médio: ${formatarPreco(precoMedio)}   ·   Mais recente: ${formatarPreco(precoMaisRecente)}`,
      larguraPagina - 14,
      y,
      { align: 'right' }
    );
    y += 8;

    if (compras.length >= 2) {
      const larguraGrafico = larguraPagina - 28;
      const alturaGrafico = 28;
      const precos = compras.map((c) => c.preco);
      const min = Math.min(...precos);
      const max = Math.max(...precos);
      const faixa = max - min || 1;
      const padX = 4;

      const coordX = (i) => 14 + padX + (i * (larguraGrafico - padX * 2)) / Math.max(1, compras.length - 1);
      const coordY = (preco) => y + alturaGrafico - 4 - ((preco - min) / faixa) * (alturaGrafico - 8);

      doc.setDrawColor(...PRIMARIA);
      doc.setLineWidth(0.6);
      for (let i = 0; i < compras.length - 1; i++) {
        doc.line(coordX(i), coordY(compras[i].preco), coordX(i + 1), coordY(compras[i + 1].preco));
      }
      doc.setFillColor(...PRIMARIA);
      compras.forEach((c, i) => {
        doc.circle(coordX(i), coordY(c.preco), 1.1, 'F');
      });

      y += alturaGrafico + 6;
    }

    autoTable(doc, {
      startY: y,
      head: [['Data', 'Preço', 'Local', 'Qtd', 'Anotações']],
      body: compras
        .slice()
        .reverse()
        .map((c) => [
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

    y = doc.lastAutoTable.finalY + 16;
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
