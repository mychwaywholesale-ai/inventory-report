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
  return `📦 千象盒子库存日报已更新 - ${ds}

✅ 最新库存数据已同步至 GitHub Pages
🔗 ${REPORT_URL}

📌 点击上方链接查看完整报表（含各SKU明细表格）`;
}
