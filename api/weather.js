// Vercel 서버 함수: 브라우저 대신 Open-Meteo(키 필요 없음)에 접속한다.
// 학교·회사 인터넷에서 날씨 사이트가 막혀 있어도, 브라우저는 우리 사이트 주소에만 접속하면 된다.
//   GET /api/weather?lat=36.79&lon=127.0   → 오늘 날씨
//   GET /api/weather?q=태안                 → 지역 이름으로 좌표 찾기

export function forecastUrl(lat, lon) {
    return `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
        + '&current=temperature_2m,relative_humidity_2m,weather_code'
        + '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,uv_index_max'
        + '&timezone=Asia%2FSeoul&forecast_days=1';
}

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'method' });
    const { lat, lon, q } = req.query || {};

    let url;
    if (q) {
        const name = String(q).trim().slice(0, 30);
        if (!name) return res.status(400).json({ error: 'bad_request' });
        url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=ko&countryCode=KR`;
    } else {
        const la = Number(lat), lo = Number(lon);
        if (!Number.isFinite(la) || !Number.isFinite(lo) || Math.abs(la) > 90 || Math.abs(lo) > 180) {
            return res.status(400).json({ error: 'bad_request' });
        }
        url = forecastUrl(la.toFixed(3), lo.toFixed(3));
    }

    try {
        const r = await fetch(url);
        if (!r.ok) return res.status(502).json({ error: 'upstream', status: r.status });
        // 같은 지역은 10분 동안 Vercel이 저장해 둔 답을 재사용 (날씨 서버 호출 줄이기)
        res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=600');
        return res.status(200).json(await r.json());
    } catch (e) {
        console.error(e);
        return res.status(502).json({ error: 'upstream' });
    }
}
