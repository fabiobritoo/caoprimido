// Entrega o PDF pronto: abre numa aba, baixa, ou abre o menu de compartilhar
// do celular (WhatsApp, e-mail, etc.) quando `compartilhar` é verdadeiro.
export async function entregarPdf(doc, janela, nomeArquivo, compartilhar = false) {
  doc.setProperties({ title: nomeArquivo.replace('.pdf', '') });

  if (compartilhar) {
    try {
      const arquivo = new File([doc.output('blob')], nomeArquivo, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nomeArquivo.replace('.pdf', '') });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return; // fechou o menu de compartilhar
    }
    doc.save(nomeArquivo); // sem suporte a compartilhar arquivo: baixa
    return;
  }

  if (janela) {
    janela.location.href = doc.output('bloburl');
  } else {
    // navegador bloqueou o popup mesmo assim — cai pro download tradicional
    doc.save(nomeArquivo);
  }
}
