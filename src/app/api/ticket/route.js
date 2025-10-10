import qrcode from 'qrcode';
import fs from 'fs';
import path from 'path';

// Função para ler o arquivo CSS. O Vercel otimiza isso.
function getTicketStyles() {
  const filePath = path.join(process.cwd(), 'src', 'styles', 'ticket.css');
  return fs.readFileSync(filePath, 'utf8');
}

// A função de template agora recebe o CSS como um parâmetro
function buildInviteHtml(nome, codigoQr, qrB64, styles) {
    const primeiroNome = nome ? nome.split(' ')[0] : '';
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresso | Evento Manada | ${nome}</title>
<style>${styles}</style>
<script>function baixarPDF(){ window.print() }</script>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="hdr">
      <div class="brand">Legendários Las Campanas — Evento Manada</div>
      <div class="btns">
        <button class="btn" onclick="location.reload()">Atualizar</button>
        <button class="btn primary" onclick="baixarPDF()">Baixar PDF</button>
      </div>
    </div>
    <div class="hero">
      <div>
        <span class="pill">Ingresso Pessoal</span>
        <h1 class="title">Olá, ${primeiroNome}!</h1>
        <p class="muted">
          Este é o seu ingresso oficial. Apresente o QR Code na entrada para validar seu acesso.
          <br><br>
          • <strong>Check-in:</strong> a partir das <strong>8:30</strong>. No local, você receberá sua camisa.
          <br>
          • <strong>Legendários:</strong> Não se esqueçam da <strong>gorra</strong>! ⚡🧢
        </p>
        <div class="kpis">
          <div class="kpi">Código: <strong>${codigoQr}</strong></div>
          <div class="kpi">Titular: <strong>${nome}</strong></div>
        </div>
      </div>
      <div class="qrbox">
        <img alt="QR de acesso para o Evento Manada" src="${qrB64}"/>
      </div>
    </div>
    <div class="foot">
      <span class="muted">Guarde este link. Você pode baixar em PDF quando quiser.</span>
      <button class="btn" onclick="baixarPDF()">Baixar PDF</button>
    </div>
  </div>
</div>
</body>
</html>`;
}

// Carrega os estilos uma vez quando o servidor inicia
const ticketStyles = getTicketStyles();

export async function GET(request) {
    const searchParams = request.nextUrl.searchParams;
    const data = searchParams.get('data');

    if (!data) {
        return new Response("Erro: Parâmetro 'data' não encontrado.", { status: 400 });
    }

    try {
        const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
        const decodedData = Buffer.from(base64, 'base64').toString('utf-8');
        const userData = JSON.parse(decodedData);
        const { nome, codigoqr } = userData;

        const qrB64 = await qrcode.toDataURL(codigoqr, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 320,
        });
        
        // Gera o HTML final passando os estilos lidos do arquivo
        const htmlContent = buildInviteHtml(nome, codigoqr, qrB64, ticketStyles);

        return new Response(htmlContent, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });

    } catch (error) {
        console.error("Erro ao gerar ingresso:", error);
        return new Response('Erro interno no servidor ao processar o ingresso.', { status: 500 });
    }
}