export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    let raw = req.method === "GET" ? req.query.url : req.body?.url;
    if (typeof raw !== "string") {
      return res.status(400).json({ ok: false, error: "URL wajib diisi." });
    }

    raw = raw.trim();
    if (!/^https?:\/\//i.test(raw)) {
      raw = "https://" + raw;
    }

    const input = new URL(raw);
    if (!["http:", "https:"].includes(input.protocol)) {
      return res.status(400).json({ ok: false, error: "Protocol tidak didukung." });
    }

    // Hanya mengikuti redirect HTTP(S) yang tersedia secara publik.
    // Tidak melewati CAPTCHA, login, token keamanan, atau halaman iklan wajib.
    let current = input.toString();
    const chain = [];
    const maxHops = 8;

    for (let i = 0; i < maxHops; i++) {
      if (chain.includes(current)) {
        return res.status(508).json({ ok: false, error: "Redirect loop terdeteksi.", chain });
      }
      chain.push(current);

      const response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        headers: {
          "User-Agent": "ADIB-SafeLink-Resolver/1.0",
          "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8"
        }
      });

      const location = response.headers.get("location");
      if (!location) {
        return res.status(200).json({
          ok: true,
          input: input.toString(),
          finalUrl: current,
          hops: chain.length - 1,
          note: "Tidak ada HTTP Location redirect berikutnya."
        });
      }

      current = new URL(location, current).toString();
    }

    return res.status(508).json({
      ok: false,
      error: "Terlalu banyak redirect.",
      chain
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "URL tidak dapat diproses.",
      detail: String(err?.message || err)
    });
  }
}
