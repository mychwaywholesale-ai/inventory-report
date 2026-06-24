const https = require('https');
const WEBHOOK = 'https://oapi.dingtalk.com/robot/send?access_token=dffa4bb7a45342c3b9621225f831016531393e241c443e9a5fb1d347089b99ee';

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
══════════════════

📍 MEX仓库

型号编码        可售  在途  已售  周转率
───────────────────────────────
AS164SE-MX      64    0     0     -
SR-NF005-MX     61    0     0     -
SD-54S1S-MX     48    0     0     -
WL-KYDS871      48    0     0     -
LY-54K2-MX      44    0     0     -
MS-33J4U-MX     40    0     0     -
HR-AS64P-MX     39    0     0     -
LS-78D2MAXSB-MX 39    0     0     -
MS-54D1S-MX     31    0     0     -
MS-76D6S8-MX    30    0     0     -

📦 汇总
可售: 964 | 在途: 1,015
待上架: 1 | 待出库: 51
已出库: 5,776
SKU种类: ~91种

⚠️ 缺货预警
• SR-AF1323-MX → 在途190
• MS-2185C-MX  → 在途43  
• WL-JMLB1218-MX → 在途42

🔄 周转预警（可售≥50）
• AS164SE-MX (64)
• SR-NF005-MX (61)

⚠️ 请关注补货！`;
}


sendDingTalk(report()).then(() => { console.log('✅ OK'); process.exit(0); }).catch(e => { console.error('❌', e); process.exit(1); });
