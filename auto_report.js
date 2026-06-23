/**
 * auto_report.js — 千象盒子库存日报 全自动生成脚本
 * 输出到用户桌面 inventory 文件夹，供 Cloudflare Tunnel 展示
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

// 用户的实际桌面路径（从CMD验证得到）
const OUT_DIR = 'C:/Users/86177/Desktop/inventory';
const HTML_FILE = path.join(OUT_DIR, 'report.html');

// 临时数据文件（放在同一目录）
const COOKIE_FILE = path.join(OUT_DIR, 'cookies_qxbox.txt');
const INV_FILE = path.join(OUT_DIR, 'inv_tmp.json');
const PROD_FILE = path.join(OUT_DIR, 'prod_tmp.json');

let cookieJar = '';

function log(msg) { console.log('['+new Date().toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})+'] ' + msg); }

function request(method, host, pathname, headers, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: host,
      port: 80,
      path: pathname,
      method: method,
      headers: headers || {},
      timeout: 30000
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.headers['set-cookie']) {
          for (let c of res.headers['set-cookie']) {
            let name = c.split('=')[0];
            let val = c.split(';')[0].substring(name.length+1);
            let re = new RegExp('(^|;\\s*)' + name + '=[^;]*');
            if (cookieJar.match(re)) {
              cookieJar = cookieJar.replace(re, '$1' + name + '=' + val);
            } else {
              cookieJar += (cookieJar ? '; ' : '') + name + '=' + val;
            }
          }
        }
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', (e) => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

function apiPost(apiPath, data) {
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  };
  if (cookieJar) headers['Cookie'] = cookieJar;
  return request('POST', 'qxbox.yunwms.com', apiPath, headers, data || '');
}

async function login() {
  log('登录千象盒子...');
  let r = await apiPost('/default/index/login', '');
  const passB64 = Buffer.from('Olibeauty654321').toString('base64');
  r = await apiPost('/default/index/login', 'userName=Olibeauty&userPass=' + passB64);
  if (r.body.includes('"state":1')) {
    log('✅ 登录成功');
    fs.writeFileSync(COOKIE_FILE, cookieJar, 'utf8');
    return true;
  }
  log('❌ 登录失败: ' + r.body.slice(0, 200));
  return false;
}

async function fetchData(apiPath, outputFile, label) {
  log('拉取数据: ' + label + '...');
  let r = await apiPost(apiPath, '');
  if (r.body.length < 100) {
    log('❌ 数据太小: ' + r.body.slice(0, 100));
    return false;
  }
  try {
    const j = JSON.parse(r.body);
    if (j.state !== 1) {
      log('❌ API错误: ' + (j.message || 'unknown'));
      return false;
    }
    fs.writeFileSync(outputFile, r.body, 'utf8');
    const count = (j.data || []).length;
    log('✅ ' + label + ': ' + count + ' 条');
    return true;
  } catch(e) {
    log('❌ 解析失败: ' + e.message);
    return false;
  }
}

function generateHTML() {
  log('生成HTML报表...');
  try {
    const inv = JSON.parse(fs.readFileSync(INV_FILE, 'utf8'));
    const prod = JSON.parse(fs.readFileSync(PROD_FILE, 'utf8'));

    const skuRef = {};
    for (let p of (prod.data||[])) { skuRef[p.product_sku] = p.reference_no; }

    const whNames = {'8':'国内中转','12':'Madrid2','18':'墨西哥MEX'};
    const skuInv = {};
    const whSum = {};
    let totals = {sellable:0, onway:0, shipped:0};

    for (let i of (inv.data||[])) {
      let sku = i.product_sku, wid = i.warehouse_id;
      let s = parseInt(i.pi_sellable||0);
      let ow = parseInt(i.pi_onway||0);
      let sh = parseInt(i.pi_shipped||0);
      totals.sellable += s; totals.onway += ow; totals.shipped += sh;
      if (!skuInv[sku]) skuInv[sku] = {sellable:0, onway:0, shipped:0};
      skuInv[sku].sellable += s; skuInv[sku].onway += ow; skuInv[sku].shipped += sh;
      if (!whSum[wid]) whSum[wid] = {sellable:0, onway:0, shipped:0, name: whNames[wid]||'仓库'+wid};
      whSum[wid].sellable += s; whSum[wid].onway += ow; whSum[wid].shipped += sh;
    }

    let sorted = Object.entries(skuInv)
      .filter(([_,v]) => v.sellable > 0 || v.onway > 0)
      .sort((a,b) => b[1].sellable - a[1].sellable);

    const d = new Date();
    const dateStr = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');

    let rows = '';
    for (let [sku, v] of sorted) {
      let ref = skuRef[sku] || sku;
      let ratio = v.sellable > 0 ? (v.shipped / v.sellable).toFixed(2) : (v.shipped > 0 ? '∞' : '0.00');
      rows += '<tr><td class="r">'+ref+'</td><td class="n">'+v.sellable+'</td><td class="n">'+v.onway+'</td><td class="n">'+v.shipped+'</td><td class="n">'+ratio+'</td></tr>';
    }

    let whHtml = '';
    for (let [wid, w] of Object.entries(whSum).sort()) {
      if (w.sellable > 0 || w.onway > 0) {
        whHtml += '<span class="tag">'+w.name+': 可售'+w.sellable+' 在途'+w.onway+'</span>';
      }
    }

    const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>库存日报 '+dateStr+'</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,"Microsoft YaHei",sans-serif;background:#f0f2f5;color:#333;padding:16px;max-width:1100px;margin:0 auto}h1{font-size:20px;margin-bottom:2px;color:#1a1a2e}.sub{color:#888;font-size:12px;margin-bottom:6px}.tags{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px}.tag{font-size:11px;padding:2px 10px;border-radius:12px;background:#e8f0fe;color:#1a73e8}.s{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:18px}.bx{background:#fff;border-radius:10px;padding:14px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08)}.bx .l{font-size:11px;color:#999;margin-bottom:3px}.bx .v{font-size:24px;font-weight:700}.g{color:#22c55e}.b{color:#3b82f6}.o{color:#f59e0b}.p{color:#8b5cf6}h2{font-size:15px;margin:0 0 10px 0;color:#1e293b}table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}th{background:#f1f5f9;padding:8px 8px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;font-size:11px}td{padding:6px 8px;border-bottom:1px solid #f1f5f9}tr:hover{background:#f8fafc}.n{text-align:right;font-variant-numeric:tabular-nums}.r{font-family:"Courier New",monospace;font-weight:500;font-size:11px;color:#0f172a}.ft{text-align:center;font-size:11px;color:#aaa;padding:16px 0}@media(max-width:600px){td,th{font-size:10px;padding:4px 5px}.s{grid-template-columns:1fr 1fr}.r{font-size:10px}}</style></head><body><h1>千象盒子 库存日报</h1><p class="sub">'+dateStr+' | Olibeauty (11353)</p><div class="tags">'+whHtml+'</div><div class="s"><div class="bx"><div class="l">可售库存</div><div class="v g">'+totals.sellable.toLocaleString()+'</div></div><div class="bx"><div class="l">在途库存</div><div class="v b">'+totals.onway.toLocaleString()+'</div></div><div class="bx"><div class="l">已售(累计)</div><div class="v p">'+totals.shipped.toLocaleString()+'</div></div><div class="bx"><div class="l">SKU种类</div><div class="v o">'+sorted.length+'</div></div></div><h2>各SKU库存明细 <span style="font-size:12px;color:#999;font-weight:400;">（按可售从多到少）</span></h2><table><thead><tr><th style="width:20%">型号编码</th><th class="n" style="width:15%">可售</th><th class="n" style="width:15%">在途</th><th class="n" style="width:15%">已售</th><th class="n" style="width:15%">周转率</th></tr></thead><tbody>'+rows+'</tbody></table><div class="ft">Olibeauty 库存日报 | '+dateStr+' | 数据来源：千象盒子 qxbox.yunwms.com</div></body></html>';

    fs.writeFileSync(HTML_FILE, html, 'utf8');
    log('✅ 报表已生成: ' + HTML_FILE + ' (' + (html.length/1024).toFixed(1) + ' KB)');
    return html;
  } catch(e) {
    log('❌ 生成HTML失败: ' + e.message);
    return null;
  }
}

async function main() {
  log('🚀 千象盒子库存日报 - 开始自动生成');
  if (!await login()) { log('❌ 终止'); process.exit(1); }
  if (!await fetchData('/product/inventory-wms/list/page/1/pageSize/300', INV_FILE, '库存数据')) { process.exit(1); }
  if (!await fetchData('/product/product/list/page/1/pageSize/200', PROD_FILE, '产品数据')) { process.exit(1); }
  const html = generateHTML();
  if (html) {
    log('📎 报表已更新: ' + HTML_FILE);
    console.log('\n---HTML_CONTENT_START---');
    console.log(html);
    console.log('---HTML_CONTENT_END---');
  }
}

main().catch(e => { log('❌ 异常: ' + e.message); process.exit(1); });
