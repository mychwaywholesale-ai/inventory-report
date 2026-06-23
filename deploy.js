const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const GIT_DIR = 'C:\\Users\\86177\\Desktop\\inventory';
const HOST = 'qxbox.yunwms.com';

let COOKIE = '';

function updateCookie(headers) {
  const setCookies = headers['set-cookie'];
  if (!setCookies) return;
  const cookies = Array.isArray(setCookies) ? setCookies : [setCookies];
  const map = {};
  COOKIE.split(';').forEach(c => {
    c = c.trim(); if(!c) return;
    const e = c.indexOf('=');
    if(e>0) map[c.slice(0,e).trim()] = c.slice(e+1).trim();
  });
  cookies.forEach(c => {
    const p = c.split(';')[0];
    const e = p.indexOf('=');
    if(e>0) {
      const k = p.slice(0,e).trim(), v = p.slice(e+1).trim();
      if(v !== 'deleted' && v !== '0') map[k] = v; else delete map[k];
    }
  });
  COOKIE = Object.entries(map).map(([k,v]) => k+'='+v).join('; ');
}

function request(method, urlPath, body, type) {
  return new Promise((resolve, reject) => {
    const b = (method==='GET' || !body) ? '' : (type==='form' ? body : JSON.stringify(body));
    const opts = {
      hostname: HOST, port: 443, path: urlPath, method,
      rejectUnauthorized: false,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
        'Accept-Language': 'zh-CN',
        'X-Requested-With': 'XMLHttpRequest',
        'Origin': 'https://'+HOST,
        'Referer': 'https://'+HOST+'/',
        'Cookie': COOKIE
      }
    };
    if(method !== 'GET' && body) {
      opts.headers['Content-Type'] = type==='form' ? 'application/x-www-form-urlencoded; charset=UTF-8' : 'application/json; charset=UTF-8';
      opts.headers['Content-Length'] = Buffer.byteLength(b);
    }
    const req = https.request(opts, res => {
      updateCookie(res.headers);
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve({raw: d}); }
      });
    });
    req.on('error', reject);
    if(method==='GET' || !body) req.end();
    else { req.write(b); req.end(); }
  });
}

async function main() {
  console.log('1. GET / (获取session)');
  let r = await request('GET', '/');
  console.log('   Cookie:', COOKIE.slice(0,80));

  console.log('2. POST /default/index/login (登录)');
  const loginRes = await request('POST', '/default/index/login', 'userName=Olibeauty&userPass=T2xpYmVhdXR5NjU0MzIx&rememberMe=true', 'form');
  console.log('   登录响应:', JSON.stringify(loginRes).slice(0,200));
  console.log('   Cookie:', COOKIE.slice(0,80));

  if(loginRes.state !== 1) {
    console.error('❌ 登录失败:', loginRes.message);
    process.exit(1);
  }

  console.log('3. GET /system/home (确认登录)');
  await request('GET', '/system/home');

  console.log('4. POST 获取库存');
  const invRes = await request('POST', '/product/inventory-wms/list/page/1/pageSize/300', {warehouse_id:18, client_code:'11353'});
  const invData = invRes && invRes.data ? invRes.data : [];
  console.log('   库存条数:', invData.length);
  if(invData.length === 0) {
    console.error('❌ 库存为空:', JSON.stringify(invRes).slice(0,500));
    process.exit(1);
  }

  // response中已有reference_no，不需要单独调产品API
  const agg = {};
  invData.forEach(item => {
    const bc = item.product_barcode;
    if(!bc) return;
    if(!agg[bc]) agg[bc] = {s:0, o:0, sh:0, ref: item.reference_no || bc};
    agg[bc].s += parseInt(item.pi_sellable) || 0;
    agg[bc].o += parseInt(item.pi_onway) || 0;
    agg[bc].sh += parseInt(item.pi_shipped) || 0;
  });

  const items = Object.entries(agg).map(([bc, v]) => {
    const total = v.s + v.sh;
    const rate = total > 0 ? (v.sh / total * 100).toFixed(1) : '0.0';
    return [v.ref, v.s, v.o, v.sh, rate];
  }).sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh', {numeric:true}));

  let tS=0, tO=0, tSh=0;
  items.forEach(i => { tS+=i[1]; tO+=i[2]; tSh+=i[3]; });
  const inc = items.filter(i => i[2]>0).sort((a,b) => b[2]-a[2]);

  const now = new Date();
  const ds = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  const ts = now.toLocaleString('zh-CN', {timeZone:'Asia/Shanghai'});

  let rows='', incRows='';
  items.forEach(i => {
    const r = parseFloat(i[4])||0;
    const cls = i[1]===0&&i[3]>0 ? 'row-zero' : (i[1]<=3&&i[1]>0 ? 'row-warn' : '');
    rows += '<tr'+(cls?' class="'+cls+'"':'')+'><td class="r">'+i[0]+'</td><td class="n">'+i[1]+'</td><td class="n">'+i[2]+'</td><td class="n">'+i[3]+'</td><td class="n">'+r.toFixed(1)+'</td></tr>\n';
  });
  inc.forEach(i => { incRows += '<tr><td class="r">'+i[0]+'</td><td class="n">'+i[2]+'</td></tr>\n'; });

  const html = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<title>千象盒子库存日报 '+ds+'</title>\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\nbody{font-family:-apple-system,"Microsoft YaHei",sans-serif;background:#f0f2f5;color:#333;padding:16px;max-width:1100px;margin:0 auto}\nh1{font-size:20px;margin-bottom:2px;color:#1a1a2e}\n.sub{color:#888;font-size:12px;margin-bottom:6px}\n.s{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:18px}\n.bx{background:#fff;border-radius:10px;padding:14px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08)}\n.bx .l{font-size:11px;color:#999;margin-bottom:3px}\n.bx .v{font-size:24px;font-weight:700}\n.g{color:#22c55e}.b{color:#3b82f6}.o{color:#f59e0b}.p{color:#8b5cf6}\nh2{font-size:15px;margin:20px 0 10px 0;color:#1e293b}\ntable{width:100%;border-collapse:collapse;font-size:12px;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08)}\nth{background:#f1f5f9;padding:8px 8px;text-align:left;font-weight:600;color:#475569;border-bottom:2px solid #e2e8f0;font-size:11px}\ntd{padding:6px 8px;border-bottom:1px solid #f1f5f9}\ntr:hover{background:#f8fafc}\n.n{text-align:right;font-variant-numeric:tabular-nums}\n.r{font-family:"Courier New",monospace;font-weight:500;font-size:11px;color:#0f172a}\n.row-warn td{background:#fffbeb!important}\n.row-warn td.n{color:#d97706!important}\n.row-zero td{background:#fef2f2!important}\n.row-zero td.n{color:#dc2626!important}\n.ft{text-align:center;font-size:11px;color:#aaa;padding:16px 0}\n</style>\n</head>\n<body>\n<h1>千象盒子 库存日报</h1>\n<p class="sub">'+ds+' | Olibeauty (11353) | MEX仓库</p>\n<div class="s">\n<div class="bx"><div class="l">可售库存</div><div class="v g">'+tS+'</div></div>\n<div class="bx"><div class="l">在途库存</div><div class="v b">'+tO+'</div></div>\n<div class="bx"><div class="l">已售总量</div><div class="v o">'+tSh.toLocaleString()+'</div></div>\n<div class="bx"><div class="l">SKU种类</div><div class="v p">'+items.length+'</div></div>\n</div>\n<h2>📋 各SKU库存明细</h2>\n<table><thead><tr><th>型号编码</th><th style="text-align:right">可售</th><th style="text-align:right">在途</th><th style="text-align:right">已售</th><th style="text-align:right">周转率</th></tr></thead>\n<tbody>'+rows+'</tbody></table>\n'+(inc.length>0?'<h2>🚚 即将入库（在途 &gt; 0）</h2><table><thead><tr><th>型号编码</th><th style="text-align:right">在途数量</th></tr></thead><tbody>'+incRows+'</tbody></table><p style="font-size:12px;color:#22c55e;margin-top:4px">📥 '+inc.length+' 个SKU即将到货，合计 '+tO+' 件</p>':'')+'\n<div class="ft">自动生成于 '+ts+' | 数据来源：千象盒子海外仓 qxbox.yunwms.com</div>\n</body>\n</html>';

  fs.writeFileSync(path.join(GIT_DIR, 'index.html'), html, 'utf-8');
  console.log('✅ index.html 已保存 ('+html.length+' 字节)');

  execSync('git add .', {cwd:GIT_DIR, stdio:'pipe'});
  execSync('git commit -m "每日库存更新 '+ds+'"', {cwd:GIT_DIR, stdio:'pipe'});
  execSync('git push origin main', {cwd:GIT_DIR, stdio:'pipe'});
  console.log('✅ 已推送到 GitHub Pages!');
  console.log('🔗 https://mychwaywholesale-ai.github.io/inventory-report/');
}

main().catch(e => { console.error('❌ 错误:', e.message); process.exit(1); });
