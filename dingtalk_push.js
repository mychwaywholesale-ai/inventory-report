const https = require('https');
const WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=dffa4bb7a45342c3b9621225f831016531393e241c443e9a5fb1d347089b99ee';
const REPORT_URL = 'https://mychwaywholesale-ai.github.io/inventory-report/';

function sendDingTalk(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ msgtype: 'text', text: { content: text } });
    const u = new URL(WEBHOOK);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, res => {
      let b = ''; res.on('data', c => b += c); res.on('end', () => {
        try { JSON.parse(b).errcode === 0 ? resolve() : reject(b) } catch(e) { reject(b) }
      });
    });
    req.on('error', e => reject(e));
    req.write(data);
    req.end();
  });
}

function report() {
  const d = new Date();
  const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  return `📊 千象盒子库存日报 - ${ds}

📦 查看完整报表（含明细表格）：
${REPORT_URL}

📋 本周可售TOP5

1. AS164SE-MX (64)
2. SR-NF005-MX (61)
3. SD-54S1S-MX (48)
4. WL-KYDS871 (48)
5. LY-54K2-MX (44)

⚠️ 缺货预警（可售=0）
SR-AF1323-MX / MS-2185C-MX / WL-JMLB1218-MX

📌 详情请点击上方链接查看`;
}

sendDingTalk(report()).then(() => { console.log('✅ OK'); process.exit(0); }).catch(e => { console.error('❌', e); process.exit(1); });
