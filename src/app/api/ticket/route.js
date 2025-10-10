// src/app/api/ticket/route.js
import qrcode from 'qrcode';

// A função que monta o HTML continua a mesma
function buildInviteHtml(nome, codigoQr, qrB64) {
    const primeiroNome = nome ? nome.split(' ')[0] : '';
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ingresso | Evento Manada | ${nome}</title>
<style>:root{{--bg:#0b0b0f;--card:#121219;--acc:#a68bff;--text:#eaeaf2;--muted:#b7b7c7}}html,body{{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,'Helvetica Neue',Arial}} .wrap{{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px}}.card{{width:100%;max-width:720px;background:linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.00)),var(--card);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:28px;box-shadow:0 10px 30px rgba(0,0,0,0.35)}}.hdr{{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px}}.brand{{font-weight:800;letter-spacing:.5px;font-size:20px;color:var(--acc)}}.btns{{display:flex;gap:10px}}.btn{{appearance:none;border:1px solid rgba(255,255,255,0.12);background:transparent;color:var(--text);padding:10px 14px;border-radius:12px;cursor:pointer;font-weight:600}}.btn.primary{{background:var(--acc);color:#0b0b0f;border-color:transparent}}.hero{{display:grid;grid-template-columns:1.2fr 1fr;gap:20px;align-items:center}}@media (max-width:720px){{.hero{{grid-template-columns:1fr}}}}.title{{font-size:32px;line-height:1.1;margin:8px 0 10px}}.muted{{color:var(--muted);font-size:14px;line-height:1.5}}.pill{{display:inline-block;border:1px dashed rgba(255,255,255,0.2);padding:6px 10px;border-radius:999px;font-size:12px;color:var(--acc)}}.qrbox{{display:flex;align-items:center;justify-content:center;background:#0e0e14;border-radius:16px;padding:16px;border:1px solid rgba(255,255,255,0.08)}}.qrbox img{{width:100%;max-width:320px;height:auto;display:block}}.foot{{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:18px}}.kpis{{display:flex;gap:12px;flex-wrap:wrap}}.kpi{{background:#0e0e14;border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:10px 12px;font-size:12px;color:var(--muted)}}@media print{{body{{background:#fff}}.wrap{{padding:0}}.card{{box-shadow:none;border:none}}.btns,.foot button{{display:none!important}}}}</style>
<script>function baixarPDF(){{window.print()}}</script>
</head><body><div class="wrap"><div class="card"><div class="hdr"><div class="brand">Legendários Las Campanas — Evento Manada</div><div class="btns"><button class="btn" onclick="location.reload()">Atualizar</button><button class="btn primary" onclick="baixarPDF()">Baixar PDF</button></div></div><div class="hero"><div><span class="pill">Ingresso Pessoal</span><h1 class="title">Olá, ${primeiroNome}!</h1><p class="muted">Este é o seu ingresso oficial. Apresente o QR Code na entrada para validar seu acesso.<br><br>• <strong>Check-in:</strong> a partir das <strong>8:30</strong>. No local, você receberá sua camisa.<br>• <strong>Legendários:</strong> Não se esqueçam da <strong>gorra</strong>! ⚡🧢</p><div class="kpis"><div class="kpi">Código: <strong>${codigoQr}</strong></div><div class="kpi">Titular: <strong>${nome}</strong></div></div></div><div class="qrbox"><img alt="QR de acesso para o Evento Manada" src="${qrB64}"/></div></div><div class="foot"><span class="muted">Guarde este link. Você pode baixar em PDF quando quiser.</span><button class="btn" onclick="baixarPDF()">Baixar PDF</button></div></div></div></body></html>`;
}

// Exporta uma função chamada GET para lidar com requisições GET
export async function GET(request) {
    // Pega os parâmetros da URL de uma nova forma
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

        const htmlContent = buildInviteHtml(nome, codigoqr, qrB64);

        // Retorna uma nova Resposta com o HTML
        return new Response(htmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
        });

    } catch (error) {
        console.error("Erro ao gerar ingresso:", error);
        return new Response('Erro interno no servidor ao processar o ingresso.', { status: 500 });
    }
}