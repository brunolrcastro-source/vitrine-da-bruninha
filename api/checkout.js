const SUPABASE_URL = "https://vckybyjublbmisoiegdk.supabase.co";
const SUPABASE_KEY = "sb_publishable_OdJyxx3Bsd0HTN-cwIGFog_EXSvcP4u";
const HANDLE = "bruna-marega";
const SITE = "https://vitrine-da-bruninha.vercel.app";
const APIS = [
  "https://api.checkout.infinitepay.io/links",
  "https://api.infinitepay.io/invoices/public/checkout"
];
const H = {apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json"};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({erro: "use POST"});
  try {
    const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const produto_id = corpo.produto_id;
    if (!produto_id) return res.status(400).json({erro: "produto_id obrigatorio"});
    const rp = await fetch(SUPABASE_URL + "/rest/v1/produtos?id=eq." + encodeURIComponent(produto_id) + "&select=*", {headers: H});
    const linhas = await rp.json();
    const p = Array.isArray(linhas) ? linhas[0] : null;
    if (!p) return res.status(404).json({erro: "produto nao encontrado"});
    if (p.status === "vendido" || p.status === "arquivado") return res.status(409).json({erro: "Esse produto ja foi vendido."});
    const centavos = Math.round(Number(p.preco) * 100);
    if (!centavos || centavos < 100) return res.status(400).json({erro: "preco invalido"});
    const order_nsu = String(produto_id) + "-" + Date.now();
    const payload = {
      handle: HANDLE,
      order_nsu: order_nsu,
      redirect_url: SITE + "/",
      webhook_url: SITE + "/api/webhook",
      items: [{description: String(p.nome).slice(0, 100), quantity: 1, price: centavos}]
    };
    let link = null, usou = null;
    const tentativas = [];
    for (const url of APIS) {
      try {
        const ri = await fetch(url, {method: "POST", headers: {"Content-Type": "application/json", "Accept": "application/json"}, body: JSON.stringify(payload)});
        const txt = await ri.text();
        let j = null;
        try { j = JSON.parse(txt); } catch (e) {}
        tentativas.push({url: url, status: ri.status, resposta: String(txt).slice(0, 200)});
        const l = j && (j.checkout_url || j.url || j.link || (j.data && (j.data.url || j.data.checkout_url)));
        if (ri.ok && l) { link = l; usou = url; break; }
      } catch (e) { tentativas.push({url: url, erro: String(e && e.message)}); }
    }
    if (!link) return res.status(502).json({erro: "nao consegui gerar o pagamento", tentativas: tentativas});
    await fetch(SUPABASE_URL + "/rest/v1/produtos?id=eq." + encodeURIComponent(produto_id), {
      method: "PATCH", headers: H,
      body: JSON.stringify({order_nsu: order_nsu, status: "reservado", reservado_em: new Date().toISOString()})
    });
    return res.status(200).json({checkout_url: link, order_nsu: order_nsu, api: usou});
  } catch (e) {
    return res.status(500).json({erro: "falha interna", detalhe: String(e && e.message)});
  }
};
