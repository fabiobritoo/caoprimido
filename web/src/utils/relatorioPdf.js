import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { listarRemedios, obterRegistros } from './storage.js';
import { listarRegistrosSaude } from './saude.js';
import { calcularAdesaoPorRemedio, calcularAdesaoGeral } from './evolucao.js';
import { rotuloUnidade, descreverFrequencia } from './constantes.js';

function formatarDataExtenso(dataStr) {
  const [ano, mes, dia] = dataStr.split('-');
  return `${dia}/${mes}/${ano}`;
}

function formatarData(date) {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

export async function gerarRelatorioPdf() {
  const remedios = await listarRemedios();
  const registros = await obterRegistros();
  const registrosSaude = await listarRegistrosSaude();

  const adesaoGeral = calcularAdesaoGeral(remedios, registros, 84);
  const adesaoPorRemedio = calcularAdesaoPorRemedio(remedios, registros, 84);

  const doc = new jsPDF();
  const larguraPagina = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFontSize(18);
  doc.setTextColor(217, 82, 122);
  doc.text('Relatório Cãoprimido', larguraPagina / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  const agora = new Date();
  doc.text(
    `Gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
    larguraPagina / 2,
    y,
    { align: 'center' }
  );
  y += 12;

  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text('Resumo de adesão (últimos 84 dias)', 14, y);
  y += 6;

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const textoAdesao = adesaoGeral === null ? 'Sem dados suficientes ainda' : `${adesaoGeral}% de adesão geral`;
  doc.text(textoAdesao, 14, y);
  y += 8;

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
          adesao ? `${adesao.percentual}% (${adesao.tomadas}/${adesao.agendadas})` : '—',
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: [217, 82, 122] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 14;
  } else {
    doc.text('Nenhum remédio cadastrado.', 14, y);
    y += 14;
  }

  if (y > 250) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(13);
  doc.setTextColor(40, 40, 40);
  doc.text('Registros de saúde', 14, y);
  y += 6;

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
      theme: 'striped',
      headStyles: { fillColor: [217, 82, 122] },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
  } else {
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    doc.text('Nenhum registro de saúde ainda.', 14, y);
  }

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Gerado pelo app Cãoprimido — não substitui orientação médica profissional.',
      larguraPagina / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`caoprimido-relatorio-${formatarData(agora)}.pdf`);
}
