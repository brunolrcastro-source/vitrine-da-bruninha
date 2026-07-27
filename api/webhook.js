/* ============================================================
   Recebe o aviso de pagamento da InfinitePay e marca o produto
   como VENDIDO - mesmo que a compradora feche o navegador antes
   de voltar pra vitrine.
   ============================================================ */

const SUPABASE_URL = "https://vckybyjublbmisoiegdk.supabase.co";
const SUPABASE_KEY = "sb_publishable_OdJyxx3Bsd0HTN-cwIGFog_EXSvcP4u";
const H = {apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json"};

function achaOrderNsu(obj, nivel) {
  if (!obj || typeof obj !== "object" || (nivel || 0) > 4) return null;
  for (const k of Object.keys(obj)) {
    if (/^order_?nsu$/i.test(k) && obj[k]) return String(obj[k]);
  }
  for (const k of Object.keys(obj)) {
    const achou = achaOrderNsu(obj[k], (nivel || 0) + 1);
    if (achou) return achou;
  }
  return null;
}

function pagoAprovado(obj) {
  const txt = JSON.stringify(obj || {}).toLowerCase();
  if (/"(status|payment_status|state)"\s*:\s*"(failed|refused|denied|canceled|cancelled|refunded|chargeback)"/.test(txt)) return false;
  return /paid|approved|success|succeeded|captured|aprovad|pago/.test(txt);
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const order_nsu = achaOrderNsu(corpo) || (req.query && req.query.order_nsu);

    console.log("[webhook] order_nsu=", order_nsu, "corpo=", JSON.stringify(corpo).slice(0, 800));

    if (!order_nsu) return res.status(200).json({ok: true, aviso: "sem order_nsu"});
    if (!pagoAprovado(corpo)) return res.status(200).json({ok: true, aviso: "pagamento nao aprovado"});

    const r = await fetch(SUPABASE_URL + "/rest/v1/produtos?order_nsu=eq." + encodeURIComponent(order_nsu), {
      method: "PATCH", headers: Object.assign({}, H, {Prefer: "return=representation"}),
      body: JSON.stringify({status: "vendido", reservado_em: null, atualizado_em: new Date().toISOString()})
    });
    const linhas = await r.json().catch(() => []);
    console.log("[webhook] produtos marcados vendidos:", Array.isArray(linhas) ? linhas.length : 0);

    return res.status(200).json({ok: true});
  } catch (e) {
    return res.status(400).json({erro: String(e && e.message)});
  }
};
