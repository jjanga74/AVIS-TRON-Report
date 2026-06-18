import express from 'express';
import puppeteer from 'puppeteer';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// 싱글톤 Puppeteer 브라우저 인스턴스
let browserInstance;
async function getBrowser() {
  if (!browserInstance) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('Puppeteer Singleton Browser initialized.');
  }
  return browserInstance;
}

// 서버 시작 시 미리 브라우저 기동 (Warm-up)
getBrowser().catch(err => console.error('Failed to initialize Puppeteer Browser:', err));

// CORS 설정 허용
app.use(cors());

// JSON 바디 파서 설정 및 정적 파일 경로 지정
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 동적 SVG 매출 차트 생성기
function generateChartSvg(data) {
  const width = 550;
  const height = 250;
  const padding = 45;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  
  const maxSales = Math.max(...data.map(d => d.sales), 1000000);
  const barWidth = graphWidth / data.length - 12;
  
  let bars = '';
  let labels = '';
  let gridLines = '';
  
  // y축 가이드 그리드 라인 (4칸)
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const y = padding + (graphHeight / gridCount) * i;
    const val = maxSales - (maxSales / gridCount) * i;
    gridLines += `
      <line x1="${padding}" y1="${y}" x2="${width - padding}" y2="${y}" stroke="#f1f5f9" stroke-width="1" />
      <text x="${padding - 8}" y="${y + 3}" font-size="8" fill="#94a3b8" text-anchor="end" font-family="'Noto Sans KR', sans-serif">₩${Math.round(val / 10000).toLocaleString()}만</text>
    `;
  }
  
  // 데이터 기반 막대 그리기
  data.forEach((d, idx) => {
    const x = padding + idx * (barWidth + 12) + 6;
    const barHeight = (graphHeight * d.sales) / maxSales;
    const y = height - padding - barHeight;
    
    // 막대 (그라데이션 및 둥근 테두리 적용)
    bars += `
      <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="url(#barGrad)" rx="4" />
      <text x="${x + barWidth / 2}" y="${y - 6}" font-size="8" font-weight="bold" fill="#334155" text-anchor="middle" font-family="'Noto Sans KR', sans-serif">₩${Math.round(d.sales / 10000).toLocaleString()}만</text>
    `;
    
    // x축 연월 라벨
    const monthLabel = d.month.includes('-') ? `${d.month.split('-')[1]}월` : d.month;
    labels += `
      <text x="${x + barWidth / 2}" y="${height - padding + 16}" font-size="8.5" fill="#64748b" text-anchor="middle" font-family="'Noto Sans KR', sans-serif">${monthLabel}</text>
    `;
  });
  
  return `
    <svg width="100%" height="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#0369a1" stop-opacity="0.85" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${bars}
      ${labels}
      <!-- x축 및 y축 베이스라인 -->
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1.5" />
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#cbd5e1" stroke-width="1.5" />
    </svg>
  `;
}

// PDF 생성 API 엔드포인트
app.post('/api/generate-pdf', async (req, res) => {
  const { templateName, data, orientation } = req.body;
  
  if (!templateName || !data) {
    return res.status(400).json({ error: '필수 파라미터(templateName, data)가 누락되었습니다.' });
  }

  let browser;
  try {
    // 1. 템플릿 파일 읽기
    const templatePath = path.join(__dirname, 'templates', `${templateName}.html`);
    let htmlContent = await fs.readFile(templatePath, 'utf8');

    // orientation이 landscape인 경우 HTML 내의 @page 설정을 가로 방향으로 변경하고 body에 landscape 클래스 주입
    if (orientation === 'landscape') {
      htmlContent = htmlContent.replace('size: A4 portrait;', 'size: A4 landscape;');
      htmlContent = htmlContent.replace(/<body/i, '<body class="landscape"');
    }

    // 2. 데이터 컴파일 (간단한 플레이스홀더 치환)
    if (templateName === 'invoice') {
      // 2-a. 송장 데이터 처리
      const itemsHtml = data.items.map(item => `
        <tr>
          <td>
            <strong>${item.name}</strong>
            ${item.description ? `<br><span style="font-size: 8pt; color: #9ca3af;">${item.description}</span>` : ''}
          </td>
          <td class="text-right">₩${Number(item.price).toLocaleString()}</td>
          <td class="text-right">${item.quantity}</td>
          <td class="text-right text-bold">₩${(item.price * item.quantity).toLocaleString()}</td>
        </tr>
      `).join('');

      const subtotal = data.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      const tax = Math.round(subtotal * 0.1);
      const total = subtotal + tax;

      // HTML 내용 치환
      const replacements = {
        companyName: data.companyName || '주식회사 아트론',
        companySub: data.companySub || 'AVIS-TRON SaaS 사업부',
        invoiceNumber: data.invoiceNumber || 'INV-202606-001',
        issueDate: data.issueDate || '2026-06-14',
        dueDate: data.dueDate || '2026-06-21',
        senderName: data.senderName || '홍길동',
        senderAddress: data.senderAddress || '서울특별시 강남구 테헤란로 123',
        senderPhone: data.senderPhone || '02-1234-5678',
        customerName: data.customerName || '고객사 주식회사',
        customerContact: data.customerContact || '김철수 팀장',
        customerAddress: data.customerAddress || '경기도 성남시 분당구 판교역로 456',
        customerEmail: data.customerEmail || 'buyer@buyercompany.com',
        items: itemsHtml,
        subtotal: subtotal.toLocaleString(),
        tax: tax.toLocaleString(),
        total: total.toLocaleString()
      };

      for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }

    } else if (templateName === 'monthly_sales') {
      // 2-b. 매출 보고서 데이터 처리
      const totalSales = data.monthlyData.reduce((sum, d) => sum + d.sales, 0);
      const avgSales = Math.round(totalSales / data.monthlyData.length);
      const maxSalesObj = data.monthlyData.reduce((prev, current) => (prev.sales > current.sales) ? prev : current);
      const maxMonthStr = `${maxSalesObj.month.split('-')[1]}월 (₩${Math.round(maxSalesObj.sales / 10000).toLocaleString()}만)`;

      const tableRowsHtml = data.monthlyData.map(d => {
        const trendClass = d.change.startsWith('+') ? 'trend-up' : 'trend-down';
        return `
          <tr>
            <td class="text-center">${d.month}</td>
            <td class="text-right text-bold">₩${d.sales.toLocaleString()}</td>
            <td class="text-right">${d.targetPercent}%</td>
            <td class="text-right ${trendClass}">${d.change}</td>
            <td>${d.remarks || '-'}</td>
          </tr>
        `;
      }).join('');

      const chartSvg = generateChartSvg(data.monthlyData);

      const replacements = {
        reportTitle: data.reportTitle || '연간 매출 실적 보고서',
        period: data.period || '2026.01 ~ 2026.06',
        generatedDate: data.generatedDate || '2026-06-14',
        summaryTotal: totalSales.toLocaleString(),
        summaryAverage: avgSales.toLocaleString(),
        summaryMaxMonth: maxMonthStr,
        chartSvg: chartSvg,
        tableRows: tableRowsHtml
      };

      for (const [key, value] of Object.entries(replacements)) {
        htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }

    // 3. Puppeteer를 이용한 PDF 렌더링 (싱글톤 브라우저 재활용)
    const activeBrowser = await getBrowser();
    var page = await activeBrowser.newPage();
    
    // 컴파일된 HTML 설정
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // PDF 생성 옵션
    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: orientation === 'landscape',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin: 0 45px; font-family: 'Noto Sans KR', sans-serif;">
          <span>리포트 출력 서비스 (Server-side Engine)</span>
          <span class="date" style="color: #94a3b8;"></span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 5px; margin: 0 45px; font-family: 'Noto Sans KR', sans-serif;">
          <span>Confidential - 본 인쇄물은 외부 유출을 금지합니다.</span>
          <span>페이지 <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: '25mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });

    await page.close(); // 탭 종료

    // 4. PDF 응답 전송
    res.contentType('application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('PDF 생성 실패:', error);
    if (page) {
      await page.close().catch(() => {});
    }
    res.status(500).json({ error: 'PDF 생성 중 서버 에러가 발생했습니다.', details: error.message });
  }
});

// HTML 데이터를 받아서 즉석에서 고정밀 A4 PDF로 변환해 주는 범용 API 엔드포인트
app.post('/api/generate-pdf-from-html', async (req, res) => {
  const { html, title, style, orientation } = req.body;
  
  if (!html) {
    return res.status(400).json({ error: '인쇄할 HTML 내용(html)이 없습니다.' });
  }

  let page;
  try {
    // 1. 전달받은 HTML을 인쇄 최적화 스타일 쉘로 래핑하고 프론트엔드 스타일 주입
    const wrappedHtml = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
          * {
            box-sizing: border-box;
          }
          body {
            font-family: 'Noto Sans KR', sans-serif;
            margin: 0;
            padding: 0;
            font-size: 10pt;
            line-height: 1.5;
            color: #1e293b;
            background-color: #ffffff;
          }
          @page {
            size: A4 ${orientation === 'landscape' ? 'landscape' : 'portrait'};
            margin: 25mm 15mm 20mm 15mm;
          }
          h1, h2, h3, h4, h5, h6 {
            color: #0f172a;
          }
          /* 테이블 정밀 인쇄용 공통 스타일 강제 주입 */
          table {
            width: 100% !important;
            border-collapse: collapse !important;
            margin-top: 15px !important;
            margin-bottom: 15px !important;
          }
          th {
            background-color: #f8fafc !important;
            color: #334155 !important;
            font-weight: 700 !important;
            border: 1px solid #cbd5e1 !important;
            padding: 10px 8px !important;
            font-size: 9.5pt !important;
            text-align: center !important;
          }
          td {
            padding: 8px 10px !important;
            font-size: 9pt !important;
            border: 1px solid #cbd5e1 !important;
            color: #334155 !important;
          }
          /* 테이블 행 잘림 제어 및 헤더 반복 */
          thead {
            display: table-header-group !important;
          }
          tr {
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
          /* 불필요한 UI 및 스크롤바 등 인쇄 시 제거 */
          .no-print, button, input[type="button"], .actions-column {
            display: none !important;
          }
          
          /* 프론트엔드 액티브 스타일 주입 (Tailwind 등 클래스 보존) */
          ${style || ''}
        </style>
      </head>
      <body class="${orientation === 'landscape' ? 'landscape' : ''}">
        <div style="padding: 10px;">
          <h1 style="font-size: 18pt; font-weight: 700; text-align: center; margin-bottom: 25px; border-bottom: 2px solid #0f172a; padding-bottom: 15px;">
            ${title || '보안 신청서 기안내역'}
          </h1>
          ${html}
        </div>
      </body>
      </html>
    `;

    // 2. 싱글톤 브라우저에서 탭을 생성하여 PDF 렌더링
    const activeBrowser = await getBrowser();
    page = await activeBrowser.newPage();
    
    await page.setContent(wrappedHtml, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: orientation === 'landscape',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin: 0 45px; font-family: 'Noto Sans KR', sans-serif;">
          <span>AVIS-TRON SaaS 보안 리포트</span>
          <span style="color: #94a3b8;">${title || ''}</span>
        </div>
      `,
      footerTemplate: `
        <div style="font-size: 8px; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 5px; margin: 0 45px; font-family: 'Noto Sans KR', sans-serif;">
          <span>Confidential - AVIS-TRON SaaS Portal</span>
          <span>페이지 <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `,
      margin: {
        top: '25mm',
        bottom: '20mm',
        left: '15mm',
        right: '15mm'
      }
    });

    await page.close();

    res.contentType('application/pdf');
    res.send(pdfBuffer);

  } catch (error) {
    console.error('HTML-to-PDF 변환 실패:', error);
    if (page) {
      await page.close().catch(() => {});
    }
    res.status(500).json({ error: '서버 PDF 인쇄 엔진 오류', details: error.message });
  }
});

// 네트워크 인터페이스에서 IPv4 주소 추출
function getLocalIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  return ips;
}

// 서버 기동
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  const ips = getLocalIps();
  console.log(`=======================================================`);
  console.log(` PDF Reporting Server is running on:`);
  console.log(` - Local:   http://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(` - Network: http://${ip}:${PORT}`);
  });
  console.log(`=======================================================`);
});
