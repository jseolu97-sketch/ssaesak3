// Vercel 서버 함수: 브라우저 대신 Gemini를 호출한다. API 키는 여기(서버 환경변수)에만 있다.
// 정해진 작업(identify / diagnose / autofill / chat)만 받아서, 남이 이 주소를 공짜 AI로 쓰지 못하게 한다.

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DAILY_LIMIT_PER_IP = Number(process.env.DAILY_LIMIT_PER_IP || 100);
const MAX_IMAGE_BASE64 = 2_000_000; // 약 1.5MB. 페이지가 600px로 줄여 보내므로 보통 100KB 안팎

const IMAGE_PROMPTS = {
    autofill: `사진 속 식물을 보고 초등학생이 이해하기 쉬운 한국어로 알려 주세요.
JSON 객체 하나로만 답하세요:
{"species": "식물의 한국어 이름 (예: 스투키, 몬스테라)", "suggestedNickname": "귀여운 별명 (예: 싱싱이)", "memo": "키우기 한 줄 팁", "waterIntervalDays": 7}
waterIntervalDays는 물 주는 간격(일)을 나타내는 1~30 사이 정수입니다. 식물이 아니면 species를 "모르겠어요"로 쓰세요.`,

    identify: `이 식물 사진을 보고 초등학생을 위해 쉽고 정확하게 설명해 주세요.
JSON 객체 하나로만 답하세요:
{"plantName": "한국어 이름", "englishName": "영어 이름 또는 학명", "category": "분류 (예: 관엽식물, 다육식물, 꽃식물)", "features": ["특징 1", "특징 2", "특징 3"], "sunlight": "햇빛 필요 정도", "waterGuide": "물 주는 방법", "waterIntervalDays": 7, "funFact": "신기하고 재미있는 사실 한 가지", "safety": "만지거나 먹으면 위험한 식물이면 주의 문구, 아니면 빈 문자열"}
확실하지 않으면 plantName에 "~ 같아요"처럼 추측이라고 표시하세요. 식물이 아니면 plantName을 "식물이 아닌 것 같아요"로 쓰세요.`,

    diagnose: `화분이나 식물 잎 사진을 보고 건강 상태를 초등학생 눈높이에서 진단해 주세요.
JSON 객체 하나로만 답하세요:
{"healthStatus": "건강함 / 물이 부족해요 / 물이 너무 많아요 / 영양소가 필요해요 / 햇빛이 부족해요 / 벌레가 있어요 중 하나", "statusEmoji": "상태 이모지 하나", "diagnosisTitle": "한 줄 진단 (예: 잎이 목말라하고 있어요!)", "symptoms": ["사진에서 본 증상 1", "증상 2"], "prescription": ["어린이가 할 수 있는 해결법 1", "해결법 2"], "encouragement": "식물에게 하는 응원 한마디"}
약품을 써야 하면 "어른과 함께"라고 꼭 적어 주세요.`,
};

const CHAT_RULES = `너는 초등학생에게 식물을 알려 주는 다정한 "식물 박사"야. 한국어로 3~5문장, 쉬운 말로 답해.
식물·자연·키우기와 관계없는 질문이면 식물 이야기로 부드럽게 돌려.
위험한 일(약품, 칼, 높은 곳, 낯선 열매 먹기)은 꼭 어른과 함께 하라고 말해. 개인 정보(이름, 주소, 학교)는 묻지도 말고 말하지도 마.`;

// shortcut: 서버 인스턴스마다 따로 세는 메모리 카운터라 정확하지 않음. 사용자가 많아지면 Upstash Redis 등으로 교체
const hits = new Map();
function overLimit(ip) {
    const day = new Date().toISOString().slice(0, 10);
    const h = hits.get(ip);
    if (!h || h.day !== day) { hits.set(ip, { day, n: 1 }); return false; }
    h.n += 1;
    return h.n > DAILY_LIMIT_PER_IP;
}

const clip = (s, n) => String(s ?? '').slice(0, n);

// 요청을 검사해서 Gemini 요청 본문으로 만든다. 잘못되면 문자열(오류 이유)을 돌려준다.
export function buildGeminiBody(body) {
    const { task } = body || {};
    if (IMAGE_PROMPTS[task]) {
        const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(body.image || '');
        if (!m) return 'image must be a jpeg/png/webp data URL';
        if (m[2].length > MAX_IMAGE_BASE64) return 'image too large';
        return {
            contents: [{ role: 'user', parts: [{ text: IMAGE_PROMPTS[task] }, { inlineData: { mimeType: m[1], data: m[2] } }] }],
            generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
        };
    }
    if (task === 'chat') {
        const msgs = Array.isArray(body.messages) ? body.messages.slice(-10) : [];
        if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return 'messages must end with a user turn';
        const contents = msgs
            .filter(m => (m.role === 'user' || m.role === 'assistant') && String(m.content || '').trim())
            .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: clip(m.content, 600) }] }));
        if (!contents.length || contents[0].role !== 'user') return 'messages must start with a user turn';
        return {
            systemInstruction: { parts: [{ text: `${CHAT_RULES}\n참고 정보: ${clip(body.context, 600)}` }] },
            contents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 600 },
        };
    }
    return 'unknown task';
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
    if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: 'no_key' });

    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (overLimit(ip)) return res.status(429).json({ error: 'daily_limit' });

    let body = req.body;
    try { if (typeof body === 'string') body = JSON.parse(body || '{}'); }
    catch { return res.status(400).json({ error: 'bad_request', detail: 'invalid JSON' }); }
    const gemini = buildGeminiBody(body);
    if (typeof gemini === 'string') return res.status(400).json({ error: 'bad_request', detail: gemini });

    try {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
            body: JSON.stringify(gemini),
        });
        if (r.status === 429) return res.status(429).json({ error: 'quota' }); // 무료 한도 소진
        if (!r.ok) {
            console.error('Gemini error', r.status, await r.text());
            return res.status(502).json({ error: 'upstream' });
        }
        const data = await r.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        if (!text) return res.status(422).json({ error: 'blocked' }); // 안전 필터 등으로 답이 없음
        if (body.task === 'chat') return res.status(200).json({ text });
        try {
            return res.status(200).json({ result: JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, '')) });
        } catch {
            return res.status(502).json({ error: 'bad_json' });
        }
    } catch (e) {
        console.error(e);
        return res.status(502).json({ error: 'upstream' });
    }
}
