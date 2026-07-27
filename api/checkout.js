/* ============================================================
   Cria o checkout da InfinitePay para um produto da vitrine.
   Roda no servidor (Vercel) - a compradora NUNCA manda o preco,
   ele e buscado no banco aqui dentro. Isso impede que alguem
   edite o valor no navegador e pague menos.
   ============================================================ */

const SUPABASE_URL = "https://vckybyjublbmisoiegdk.supabase.co";
const SUPABASE_KEY = "sb_publishable_OdJyxx3Bsd0HTN-cwIGFog_EXSvcP4u";
const HANDLE = "bruna-marega";
const SITE = "https://vitrine-da-bruninha.vercel.app";
const API_INFINITEPAY = "https://api.infinitepay.io/invoices/public/checkout";

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
    if (p.status === "vendido" || p.status === "arquivado") {
      return res.status(409).json({erro: "Esse produto ja foi vendido."});
    }

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

    const ri = await fetch(API_INFINITEPAY, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(payload)
    });
    const ji = await ri.json().catch(() => ({}));
    if (!ri.ok || !ji.checkout_url) {
      return res.status(502).json({erro: "nao consegui gerar o pagamento", detalhe: ji});
    }

    await fetch(SUPABASE_URL + "/rest/v1/produtos?id=eq." + encodeURIComponent(produto_id), {
      method: "PATCH", headers: H,
      body: JSON.stringify({order_nsu: order_nsu, status: "reservado", reservado_em: new Date().toISOString()})
    });

    return res.status(200).json({checkout_url: ji.checkout_url, order_nsu: order_nsu});
  } catch (e) {
    return res.status(500).json({erro: "falha interna", detalhe: String(e && e.message)});
  }
};
