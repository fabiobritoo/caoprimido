import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listarRemedios, obterRegistros } from './storage.js';
import { obterTodasCompras } from './compras.js';
import { entregarPdf } from './pdfSaida.js';
import { rotuloUnidade, remedioEstaAtivo, formatarData, doseDoDia, formatarQuantidade, formatarDataBR, formatarPreco, formatarVariacao, mediaDosesPorDia } from './constantes.js';

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



function ultimaDoseDoRemedio(remedioId, registros) {
  let maisRecente = null;
  for (const chave in registros) {
    const [id, data] = chave.split('|');
    if (id !== remedioId) continue;
    if (!maisRecente || data > maisRecente) maisRecente = data;
  }
  return maisRecente;
}

// Calcula a média de doses por dia considerando a frequência real do
// remédio — sem isso, um remédio "1x por semana" seria calculado como se
// fosse tomado todo santo dia, inflando o custo estimado em até 7x

function descreverFrequenciaResumo(remedio) {
  const freq = remedio.frequencia;
  const horariosPorDia = remedio.horarios?.length || 1;
  const dose = `${formatarQuantidade(doseDoDia(remedio, formatarData(new Date())))} ${rotuloUnidade(remedio.unidade).toLowerCase()}`;
  const faseTexto = remedio.fases?.length > 1 ? ' (dose atual)' : '';
  const sufixo = `${dose} por dose${faseTexto}`;
  const porDia = horariosPorDia === 1 ? '1 dose' : `${horariosPorDia} doses`;

  if (freq?.tipo === 'sob_demanda') return `só quando precisar · ${sufixo}`;
  if (!freq || freq.tipo === 'diaria') return `todos os dias · ${horariosPorDia}x ao dia · ${sufixo}`;
  if (freq.tipo === 'dias_semana') {
    const n = freq.dias?.length || 0;
    const diasTexto = n === 1 ? '1x por semana' : `${n}x por semana`;
    return `${diasTexto} (${porDia} por dia de uso) · ${sufixo}`;
  }
  if (freq.tipo === 'intervalo') {
    return `a cada ${freq.intervaloDias || 1} dias (${porDia} por dia de uso) · ${sufixo}`;
  }
  return sufixo;
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

export async function gerarRelatorioPrecoPdf({ modoBob = false, compartilhar = false } = {}) {
  const janela = compartilhar ? null : window.open('', '_blank');

  const paleta = obterPaletaPdf(modoBob);
  const { PRIMARIA, PRIMARIA_ESCURA, DOURADO, CREME, TEXTO_PRINCIPAL, TEXTO_SECUNDARIO, BRANCO, SUCESSO, PERIGO } =
    paleta;

  const remedios = await listarRemedios();
  const registros = await obterRegistros();
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
    await entregarPdf(doc, janela, 'caoprimido-relatorio-precos.pdf', compartilhar);
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

    // variação pelo preço POR UNIDADE quando as duas compras têm quantidade
    const usaUnidade = maisRecente.quantidade > 0 && primeira.quantidade > 0;
    const valorAtual = usaUnidade ? maisRecente.preco / maisRecente.quantidade : maisRecente.preco;
    const valorInicial = usaUnidade ? primeira.preco / primeira.quantidade : primeira.preco;
    const variacaoDesdeInicio = compras.length > 1 ? ((valorAtual - valorInicial) / valorInicial) * 100 : null;

    // o preço mais recente é o mais alto / o mais baixo já pago? (só com 2+ compras)
    const todasComQtd = compras.every((c) => c.quantidade > 0);
    const valorDe = (c) => (todasComQtd ? c.preco / c.quantidade : c.preco);
    const anteriores = compras.slice(0, -1).map(valorDe);
    const ultimoValor = valorDe(maisRecente);
    let extremo = null;
    if (anteriores.length > 0) {
      if (ultimoValor > Math.max(...anteriores)) extremo = 'maior';
      else if (ultimoValor < Math.min(...anteriores)) extremo = 'menor';
    }

    let custoPorDose = null;
    let rendeDias = null;
    if (maisRecente.quantidade > 0) {
      const porDose = doseDoDia(remedio, formatarData(new Date()));
      custoPorDose = (maisRecente.preco / maisRecente.quantidade) * porDose;
      const consumoDia = mediaDosesPorDia(remedio) * porDose;
      if (consumoDia > 0) rendeDias = Math.floor(maisRecente.quantidade / consumoDia);
    }

    let custoDiarioEstimado = null;
    if (maisRecente.quantidade > 0) {
      const precoPorUnidade = maisRecente.preco / maisRecente.quantidade;
      const dosesPorDia = mediaDosesPorDia(remedio);
      custoDiarioEstimado = precoPorUnidade * doseDoDia(remedio, formatarData(new Date())) * dosesPorDia;
    }

    const locais = [...new Set(compras.filter((c) => c.local).map((c) => c.local))];
    let localMaisBarato = null;
    if (locais.length > 1) {
      const todasComQuantidade = compras.every((c) => c.quantidade > 0);
      const valor = (c) => (todasComQuantidade ? c.preco / c.quantidade : c.preco);
      const compraMaisBarata = compras.reduce((menor, c) => (valor(c) < valor(menor) ? c : menor));
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
      variacaoPorUnidade: usaUnidade,
      custoDiarioEstimado,
      custoPorDose,
      rendeDias,
      extremo,
      extremoPorUnidade: todasComQtd,
      localMaisBarato,
    };
  });

  const hojeStrRelatorio = formatarData(new Date());
  const metricasAtivas = metricasPorRemedio.filter((m) => remedioEstaAtivo(m.remedio, hojeStrRelatorio));
  const metricasParadas = metricasPorRemedio.filter((m) => !remedioEstaAtivo(m.remedio, hojeStrRelatorio));

  // os cartões de resumo (gasto/custo estimado) só consideram remédios
  // ativos — não faz sentido incluir na estimativa atual algo que já foi
  // descontinuado
  const gastoRecente = metricasAtivas.reduce((soma, m) => soma + m.maisRecente.preco, 0);
  const custoDiarioTotal = metricasAtivas.reduce((soma, m) => soma + (m.custoDiarioEstimado || 0), 0);

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

  function renderizarBlocoRemedio(m) {
    const { remedio, compras, maisRecente, precoMedio, precoMinimo, precoMaximo, variacaoDesdeInicio, variacaoPorUnidade } = m;

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
    doc.text(`Mais recente: ${formatarPreco(maisRecente.preco)}${maisRecente.quantidade > 0 ? ` (${formatarPreco(maisRecente.preco / maisRecente.quantidade)}/un.)` : ''}`, larguraPagina - 14, y, { align: 'right' });
    y += 7;

    const metricasTexto = [
      `Médio: ${formatarPreco(precoMedio)}`,
      `Mín: ${formatarPreco(precoMinimo)}`,
      `Máx: ${formatarPreco(precoMaximo)}`,
    ];
    // remédio parado não tem custo mensal "atual" — só histórico
    if (m.custoPorDose != null) {
      metricasTexto.push(`Custo/dose: ${formatarPreco(m.custoPorDose)}`);
    }
    if (m.custoDiarioEstimado != null && remedioEstaAtivo(remedio, hojeStrRelatorio)) {
      metricasTexto.push(`Custo/mês: ${formatarPreco(m.custoDiarioEstimado * 30)}`);
    }
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXTO_SECUNDARIO);
    doc.text(metricasTexto.join('   ·   '), 14, y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    const linhasFrequencia = doc.splitTextToSize(`Frequência: ${descreverFrequenciaResumo(remedio)}`, larguraPagina - 28);
    doc.text(linhasFrequencia, 14, y);
    doc.setFont('helvetica', 'normal');
    y += linhasFrequencia.length * 4.2 + 2;

    if (!remedioEstaAtivo(remedio, hojeStrRelatorio)) {
      const ultimaDose = ultimaDoseDoRemedio(remedio.id, registros);
      doc.setFontSize(8.5);
      doc.setTextColor(...TEXTO_SECUNDARIO);
      doc.text(
        `Última dose: ${ultimaDose ? formatarDataBR(ultimaDose) : '—'}   ·   Parou em: ${
          remedio.dataTermino ? formatarDataBR(remedio.dataTermino) : '—'
        }`,
        14,
        y
      );
      y += 6;
    }

    if (variacaoDesdeInicio != null && Math.abs(variacaoDesdeInicio) >= 0.5) {
      const subiu = variacaoDesdeInicio > 0;
      doc.setTextColor(...(subiu ? PERIGO : SUCESSO));
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Variação: ${formatarVariacao(variacaoDesdeInicio)}${variacaoPorUnidade ? ' por unidade' : ''} desde a primeira compra registrada`,
        14,
        y
      );
      y += 6;
    }

    if (m.extremo) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...(m.extremo === 'maior' ? PERIGO : SUCESSO));
      doc.text(
        m.extremo === 'maior'
          ? `Atenção: o preço mais recente é o mais alto já pago${m.extremoPorUnidade ? ' (por unidade)' : ''}.`
          : `O preço mais recente é o mais baixo já pago${m.extremoPorUnidade ? ' (por unidade)' : ''}.`,
        14,
        y
      );
      y += 6;
    }

    if (m.rendeDias != null && remedioEstaAtivo(remedio, hojeStrRelatorio)) {
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...TEXTO_SECUNDARIO);
      doc.text(`A última compra (${formatarDataBR(maisRecente.data)}) rende ~${m.rendeDias} ${m.rendeDias === 1 ? 'dia' : 'dias'} de uso.`, 14, y);
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
        formatarDataBR(c.data),
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

  metricasAtivas.forEach(renderizarBlocoRemedio);

  if (metricasParadas.length > 0) {
    if (y > alturaPagina - 40) {
      doc.addPage();
      y = 20;
    }
    doc.setFillColor(...PRIMARIA);
    doc.rect(14, y - 5, 3, 6, 'F');
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...TEXTO_PRINCIPAL);
    doc.text('Remédios parados', 20, y);
    y += 12;

    metricasParadas.forEach(renderizarBlocoRemedio);
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

  await entregarPdf(doc, janela, 'caoprimido-relatorio-precos.pdf', compartilhar);
}
