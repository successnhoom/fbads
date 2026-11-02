# AI Ads Expert – Facebook Ads Autopilot

ระบบ AI บริหารโฆษณา Facebook / Instagram (Meta Ads) แบบครบวงจร เชื่อมต่อบัญชีโฆษณาจริงผ่าน **Meta Marketing API** และใช้ **Claude** เป็นสมองในการตัดสินใจ

| ความสามารถ | ทำอะไร |
|---|---|
| 🎯 AI หากลุ่มเป้าหมาย | บรีฟสินค้า → AI คิด persona 3-6 กลุ่ม → แปลงเป็น interest จริงใน Meta → ประเมินขนาด audience |
| 🧠 AI วางแผนแคมเปญ | วางโครงสร้าง campaign / ad set / แบ่งงบ / เขียนแอด → **สร้างจริงในบัญชี** ด้วยคลิกเดียว (เริ่มสถานะหยุดเพื่อตรวจก่อน) |
| 💰 ออโต้ปรับงบ | AI ดูตัวเลขทุกวัน เพิ่มงบตัวดี ลดงบ/หยุดตัวแย่ ภายใต้ guardrails ที่คุณตั้ง (เพดานงบรวม, % ปรับต่อรอบ, target CPA/ROAS) เลือกได้ว่า "ทำทันที" หรือ "รอฉันอนุมัติ" |
| ✍️ AI เขียนแอด | Primary text / Headline / Description หลายมุม ภาษาไทย ตามนโยบาย Meta |
| 📊 รายงานละเอียด | รายวัน / รายสัปดาห์ / กำหนดเอง: สรุปผู้บริหาร, ตามแคมเปญ, ad set, ครีเอทีฟ, อายุ-เพศ, placement, สิ่งที่ AI ทำไป, ปัญหา, แผนรอบถัดไป |
| 🔔 แจ้งเตือน | ส่งผลไป webhook (Discord / Slack / Make / n8n / LINE ผ่าน relay) |
| 📒 Audit log | ทุก action ที่ AI เสนอหรือทำ บันทึกพร้อมเหตุผลและความมั่นใจ |

## เริ่มใช้งานใน 5 นาที

```bash
npm install
cp .env.example .env     # แล้วแก้ค่าในไฟล์ .env
npm run db:push          # สร้างฐานข้อมูล SQLite
npm run dev              # เปิด http://localhost:3000
```

### 1. คีย์ที่ต้องมี (`.env`)

| ตัวแปร | ได้จากไหน |
|---|---|
| `ANTHROPIC_API_KEY` | https://platform.claude.com |
| `META_APP_ID`, `META_APP_SECRET` | https://developers.facebook.com/apps → สร้างแอปประเภท **Business** → เพิ่ม product **Marketing API** และ **Facebook Login for Business** |
| `META_ACCESS_TOKEN` (ทางลัด) | Business Settings → System Users → สร้าง token ที่มีสิทธิ์ `ads_management, ads_read, business_management, pages_show_list` แล้ว assign ad account + page ให้ system user |
| `APP_URL` | URL ของแอป เช่น `http://localhost:3000` (ใช้ทำ OAuth redirect) |
| `APP_SECRET_KEY` | สุ่มเอง 32+ ตัวอักษร ใช้เข้ารหัส token ในฐานข้อมูล |
| `CRON_SECRET` | สุ่มเอง ใช้ป้องกัน endpoint cron |

### 2. เชื่อมต่อบัญชีโฆษณา (หน้า **ตั้งค่า**)

- **วิธี A – ล็อกอิน Facebook**: ใส่ `META_APP_ID/SECRET` แล้วเพิ่ม Redirect URI `APP_URL/api/auth/facebook/callback` ใน Facebook Login settings ของแอป → กด "เชื่อมต่อด้วย Facebook" (ได้ long-lived token 60 วัน)
- **วิธี B – วาง token**: ใส่ System User token (ไม่หมดอายุ) ในช่อง แล้วกดเชื่อมต่อ – แนะนำสำหรับใช้คนเดียว ไม่ต้องผ่าน App Review

จากนั้นเลือก **เพจ** และ **Pixel** ที่จะใช้สร้างแคมเปญ

> แอปที่อยู่ในโหมด Development ใช้ได้กับบัญชีของ admin/developer/tester ของแอปเท่านั้น ถ้าจะให้คนอื่นล็อกอินต้องขอ `ads_management` ผ่าน App Review

### 3. ตั้งเวลาให้ AI ทำงานเอง

| endpoint | ทำอะไร |
|---|---|
| `GET /api/cron/optimize` | รันรอบปรับงบทุกบัญชีที่เปิดออโต้ |
| `GET /api/cron/report?type=daily` | สร้างรายงานรายวัน (+ ส่ง webhook) |
| `GET /api/cron/report?type=weekly` | สร้างรายงานรายสัปดาห์ |

ทุก endpoint ต้องส่ง `Authorization: Bearer <CRON_SECRET>` หรือ `?secret=<CRON_SECRET>`

- **Vercel**: `vercel.json` ตั้ง cron ไว้แล้ว (Vercel ส่ง header ให้อัตโนมัติถ้าตั้ง env `CRON_SECRET`)
- **GitHub Actions**: `.github/workflows/cron.yml` (ตั้ง variable `APP_URL` และ secret `CRON_SECRET`)
- หรือใช้ cron-job.org / n8n / Make เรียก URL

## ระบบตัดสินใจของ AI ทำงานอย่างไร

```
Meta Insights (7 วัน + ช่วงก่อนหน้า + รายวัน)
   │
   ▼
กฎเชิงตัวเลข (lib/automation/rules.ts)
   • learning phase: ใช้จ่ายไม่ถึงขั้นต่ำ → ไม่แตะ
   • CPA/ROAS เทียบเป้า, frequency สูง, CTR ต่ำ, เทรนด์ CPA แย่ลง/ดีขึ้น
   • เสนอ action เบื้องต้น: scale_up / scale_down / pause / keep
   │
   ▼
Claude (lib/ai/optimizer.ts) – มองภาพรวมทั้งบัญชี
   • ย้ายงบจากตัวแย่ไปตัวดี, ให้เหตุผลอ้างอิงตัวเลข, confidence
   │
   ▼
Guardrails (บังคับเสมอ)
   • ปรับงบไม่เกิน maxChangePct ต่อรอบ
   • งบ ad set อยู่ใน min–max
   • งบรวมที่เปิดอยู่ไม่เกิน dailyBudgetCap
   │
   ▼
โหมด approve → รอกดอนุมัติในหน้าเว็บ   |   โหมด auto → ทำทันทีผ่าน Marketing API
```

ทุกอย่างบันทึกใน `ActionLog` (ก่อน/หลัง/เหตุผล/สถานะ)

## โครงสร้างโค้ด

```
app/                    หน้าเว็บ (Next.js App Router, ภาษาไทย)
  api/                  REST endpoints
    auth/facebook       OAuth login
    accounts            เชื่อมต่อ/เลือกบัญชี, เพจ, พิกเซล
    overview            ดึงโครงสร้าง + insights
    entities/[id]       ปรับสถานะ/งบด้วยมือ
    ai/audience|creative|plan|report   ฟีเจอร์ AI
    automation/*        ตั้งค่า, รัน, อนุมัติ action
    cron/*              endpoint สำหรับตั้งเวลา
lib/
  meta/client.ts        Meta Marketing API client (campaigns, adsets, ads, insights, targeting search, create/update)
  meta/insights.ts      แปลงตัวเลข Meta → metrics มาตรฐาน (results ตาม objective, CPA, ROAS)
  meta/data.ts          โหลด snapshot ทั้งบัญชี
  ai/claude.ts          Claude wrapper (structured output ด้วย zod)
  ai/audience.ts        หากลุ่มเป้าหมาย + resolve interest
  ai/optimizer.ts       ตัดสินใจปรับงบ
  ai/planner.ts         วางแผน + สร้างแคมเปญจริง
  ai/creative.ts        เขียนแอด
  ai/report.ts          รายงาน
  automation/rules.ts   กฎตัวเลข + guardrails (pure, มี unit test)
  automation/run.ts     รันรอบ optimize / อนุมัติ / แจ้งเตือน
prisma/schema.prisma    ฐานข้อมูล (SQLite ค่าเริ่มต้น เปลี่ยนเป็น PostgreSQL ได้โดยแก้ provider)
tests/                  unit tests: npm test
```

## Deploy

1. ใช้ PostgreSQL บน production (Neon / Supabase ฟรี): แก้ `provider = "postgresql"` ใน `prisma/schema.prisma` แล้วตั้ง `DATABASE_URL`
2. ตั้ง env ทั้งหมดบน Vercel / Railway / Render
3. `npm run build` จะรัน `prisma generate` ให้อัตโนมัติ, รัน `npx prisma db push` ครั้งแรก
4. เพิ่ม `APP_URL/api/auth/facebook/callback` ใน Facebook Login → Valid OAuth Redirect URIs

## หมายเหตุด้านความปลอดภัย

- แอปนี้ไม่มีระบบล็อกอินผู้ใช้ – ออกแบบให้ใช้คนเดียว/ทีมเดียว ถ้าจะเปิด public ควรใส่ auth (เช่น Vercel Password Protection, Cloudflare Access, หรือ NextAuth) หน้าแอป
- Access token ถูกเข้ารหัส AES-256-GCM ด้วย `APP_SECRET_KEY` ก่อนเก็บ
- การสร้างแคมเปญจาก AI จะเริ่มในสถานะ **PAUSED** เสมอ ยกเว้นกดเลือก "สร้างและเปิดทันที"
- โหมดออโต้ "ทำทันที" ควรเปิดหลังจากทดลองโหมด "รออนุมัติ" จนมั่นใจใน guardrails แล้ว

## เปลี่ยนโมเดล AI

ตั้ง `AI_MODEL` ใน `.env` (ค่าเริ่มต้น `claude-opus-5-5`) – ใช้ `claude-sonnet-5-5` ถ้าต้องการประหยัดค่าใช้จ่าย
