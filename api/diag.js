// TEMPORARIO - diagnostico da API InfinitePay. Apagar depois.
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  try {
    const corpo = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const r = await fetch("https://api.infinitepay.io/invoices/public/checkout", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify(corpo)
    });
    const texto = await r.text();
    return res.status(200).json({status: r.status, resposta: texto.slice(0, 500)});
  } catch (e) {
    return res.status(200).json({erro: String(e && e.message)});
  }
};
