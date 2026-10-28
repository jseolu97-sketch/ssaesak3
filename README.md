# 🌱 새싹이의 식물 탐험대

초등학생을 위한 식물 키우기 웹앱이에요. 로그인 없이 누구나 링크로 쓸 수 있어요.

- 🪴 내 식물밭: 물주기 알림 (기록은 각자 기기의 브라우저에 저장)
- 🌤️ 지역 날씨 맞춤 케어: 지역 검색, 빠른 도시 버튼, 내 위치 (Open-Meteo, 키 필요 없음)
- 📸 AI 식물 이름 찾기 · 🩺 AI 건강 진단 · 🦉 식물 박사 질문 (Google Gemini)

## 폴더 구성

| 파일 | 하는 일 |
|---|---|
| `public/index.html` | 웹페이지 전부 |
| `api/ai.js` | Gemini를 대신 불러 주는 서버 함수. API 키는 여기서만 쓰여서 방문자에게 보이지 않아요 |
| `package.json` | Vercel 설정용 (설치할 것 없음) |

## 배포하기 (약 10분, 모두 무료)

### 1. Gemini API 키 받기
1. https://aistudio.google.com 에 구글 계정으로 로그인
2. **Get API key → Create API key** 를 눌러 키를 복사해 두세요.
3. 이 프로젝트에는 **결제(Billing)를 연결하지 마세요.** 연결하지 않으면 무료 한도를 넘어도 요금이 나오지 않고, AI만 잠시 멈춰요.

### 2. GitHub에 올리기
1. https://github.com 에 가입·로그인 → 오른쪽 위 **+ → New repository**
2. 이름(예: `saessak`)을 적고 **Create repository**
3. **uploading an existing file** 링크를 누르고, 압축을 푼 폴더 **안의 내용물**(`api`, `public`, `package.json`, `README.md`)을 끌어다 놓은 뒤 **Commit changes**

### 3. Vercel에 배포하기
1. https://vercel.com 에서 **Continue with GitHub** 로 가입
2. **Add New… → Project** → 방금 만든 저장소 옆 **Import**
3. **Environment Variables** 를 펼쳐서 추가:
   - Name: `GEMINI_API_KEY` / Value: 1단계에서 복사한 키
4. **Deploy** → 1분쯤 뒤 `https://saessak-xxxx.vercel.app` 같은 주소가 생겨요. 이 주소를 아이들에게 나눠 주면 끝!

> 키를 나중에 바꾸거나 추가하면 Vercel의 **Settings → Environment Variables** 에서 고친 뒤 **Deployments → Redeploy** 를 눌러야 반영돼요.

## 선택 설정 (Environment Variables)

| 이름 | 기본값 | 설명 |
|---|---|---|
| `GEMINI_MODEL` | `gemini-2.5-flash` | 쓸 Gemini 모델. 한도가 더 넉넉한 `gemini-2.5-flash-lite` 로 바꿀 수 있어요 |
| `DAILY_LIMIT_PER_IP` | `100` | 같은 인터넷 주소에서 하루에 부를 수 있는 AI 횟수. 학교는 반 전체가 주소 하나를 같이 쓰니 넉넉히 두세요 |

## 알아 둘 점

- **무료 한도는 모든 사용자가 함께 나눠 써요.** 한도를 다 쓰면 "AI가 쉬는 중" 안내가 나오고, 물주기·날씨 기능은 그대로 돼요. 한도는 Google AI Studio에서 확인하세요.
- 한국에서는 Gemini 무료 등급의 질문과 사진이 구글 서비스 개선에 쓰일 수 있어요. 아이들에게 **얼굴이나 이름표가 나오지 않게 식물만 찍도록** 안내해 주세요.
- 식물 기록은 서버가 아니라 각자 기기의 브라우저에 저장돼요. 브라우저 기록을 지우면 사라져요.
