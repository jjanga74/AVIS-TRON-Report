document.addEventListener('DOMContentLoaded', () => {
  // --- 테마 설정 및 토글 ---
  const htmlEl = document.documentElement;
  const themeToggleBtn = document.getElementById('theme-toggle');
  
  // 저장된 테마 불러오기 또는 다크모드를 기본값으로 사용
  const savedTheme = localStorage.getItem('theme') || 'dark';
  htmlEl.setAttribute('data-theme', savedTheme);

  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlEl.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  });

  // --- 날짜 인풋 기본값 설정 ---
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  document.getElementById('inv-issue-date').value = today;
  document.getElementById('inv-due-date').value = nextWeek;
  document.getElementById('sales-date').value = today;

  // --- 템플릿 탭 전환 ---
  let activeTemplate = 'invoice';
  const tabs = document.querySelectorAll('.template-tab');
  const formGroups = document.querySelectorAll('.form-group');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      activeTemplate = tab.getAttribute('data-template');
      
      formGroups.forEach(form => {
        form.classList.remove('active');
        if (form.id === `${activeTemplate}-form-group`) {
          form.classList.add('active');
        }
      });
    });
  });

  // --- 인쇄 방향 탭 전환 ---
  let activeOrientation = 'portrait';
  const orientationTabs = document.querySelectorAll('.orientation-tab');

  orientationTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      orientationTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeOrientation = tab.getAttribute('data-orientation');
    });
  });

  // --- [송장] 품목 동적 테이블 관리 ---
  let invoiceItems = [
    { name: 'AVIS-TRON Core SaaS 라이센스', price: 1200000, quantity: 2, description: '클라우드 엔터프라이즈 에디션 (1년 약정)' },
    { name: '보안 침입 탐지 시스템 연동 모듈', price: 450000, quantity: 1, description: 'IPS & Firewall 실시간 연동 모듈 추가' },
    { name: '전문가 설치 지원 및 최적화 컨설팅', price: 800000, quantity: 1, description: '시스템 초기 세팅 및 DB 마이그레이션' }
  ];

  const invoiceItemsBody = document.getElementById('invoice-items-body');
  const addItemBtn = document.getElementById('add-item-btn');

  function renderInvoiceItems() {
    invoiceItemsBody.innerHTML = '';
    invoiceItems.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <input type="text" value="${item.name}" class="item-name-input" placeholder="품목명" style="font-weight:600;"><br>
          <input type="text" value="${item.description || ''}" class="item-desc-input" placeholder="상세 규격 또는 설명" style="font-size:10px; color:var(--text-secondary); margin-top:2px;">
        </td>
        <td>
          <input type="number" value="${item.price}" class="item-price-input text-right" style="text-align:right;">
        </td>
        <td>
          <input type="number" value="${item.quantity}" class="item-qty-input text-right" style="text-align:right;">
        </td>
        <td>
          <button class="delete-btn" data-index="${index}">&times;</button>
        </td>
      `;

      // 인풋 이벤트 리스너 바인딩
      tr.querySelector('.item-name-input').addEventListener('input', (e) => {
        invoiceItems[index].name = e.target.value;
      });
      tr.querySelector('.item-desc-input').addEventListener('input', (e) => {
        invoiceItems[index].description = e.target.value;
      });
      tr.querySelector('.item-price-input').addEventListener('input', (e) => {
        invoiceItems[index].price = Number(e.target.value);
      });
      tr.querySelector('.item-qty-input').addEventListener('input', (e) => {
        invoiceItems[index].quantity = Number(e.target.value);
      });
      tr.querySelector('.delete-btn').addEventListener('click', () => {
        invoiceItems.splice(index, 1);
        renderInvoiceItems();
      });

      invoiceItemsBody.appendChild(tr);
    });
  }

  addItemBtn.addEventListener('click', () => {
    invoiceItems.push({ name: '', price: 0, quantity: 1, description: '' });
    renderInvoiceItems();
  });

  // --- [매출 보고서] 월간 실적 동적 테이블 관리 ---
  let monthlySalesData = [
    { month: '2026-01', sales: 45000000, targetPercent: 102, change: '+5.4%' },
    { month: '2026-02', sales: 48500000, targetPercent: 110, change: '+7.7%' },
    { month: '2026-03', sales: 42000000, targetPercent: 95, change: '-13.4%' },
    { month: '2026-04', sales: 52000000, targetPercent: 118, change: '+23.8%' },
    { month: '2026-05', sales: 58000000, targetPercent: 125, change: '+11.5%' },
    { month: '2026-06', sales: 61200000, targetPercent: 130, change: '+5.5%' }
  ];

  const salesDataBody = document.getElementById('sales-data-body');

  function renderSalesData() {
    salesDataBody.innerHTML = '';
    monthlySalesData.forEach((item, index) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="text-center" style="font-weight:600; font-size:12px; color:var(--text-secondary); vertical-align:middle;">
          ${item.month}
        </td>
        <td>
          <input type="number" value="${item.sales}" class="sales-input" style="text-align:right; font-weight:600;">
        </td>
        <td>
          <input type="number" value="${item.targetPercent}" class="target-input" style="text-align:right;">
        </td>
        <td>
          <input type="text" value="${item.change}" class="change-input" style="text-align:center;">
        </td>
      `;

      // 인풋 이벤트 리스너 바인딩
      tr.querySelector('.sales-input').addEventListener('input', (e) => {
        monthlySalesData[index].sales = Number(e.target.value);
        recalculateSalesTrends();
      });
      tr.querySelector('.target-input').addEventListener('input', (e) => {
        monthlySalesData[index].targetPercent = Number(e.target.value);
      });
      tr.querySelector('.change-input').addEventListener('input', (e) => {
        monthlySalesData[index].change = e.target.value;
      });

      salesDataBody.appendChild(tr);
    });
  }

  // 매출 입력 시 전월 대비 증감(%)을 대략 계산해주는 보조 함수 (동작 편의성용)
  function recalculateSalesTrends() {
    for (let i = 1; i < monthlySalesData.length; i++) {
      const prevSales = monthlySalesData[i - 1].sales;
      const currentSales = monthlySalesData[i].sales;
      if (prevSales > 0) {
        const diffPercent = ((currentSales - prevSales) / prevSales) * 100;
        const sign = diffPercent >= 0 ? '+' : '';
        // 입력 필드를 직접 업데이트하지 않고 데이터 모델만 갱신 (사용자가 수동 수정도 할 수 있게 하기 위함)
        const changeInput = salesDataBody.children[i].querySelector('.change-input');
        if (document.activeElement !== changeInput) {
          monthlySalesData[i].change = `${sign}${diffPercent.toFixed(1)}%`;
          changeInput.value = monthlySalesData[i].change;
        }
      }
    }
  }

  // --- 초기화 렌더링 실행 ---
  renderInvoiceItems();
  renderSalesData();

  // --- PDF 생성 연동 ---
  const generatePdfBtn = document.getElementById('generate-pdf-btn');
  const loader = document.getElementById('loader');
  const placeholder = document.getElementById('placeholder');
  const pdfViewer = document.getElementById('pdf-viewer');
  const viewerStatus = document.getElementById('viewer-status');

  generatePdfBtn.addEventListener('click', async () => {
    // 1. UI 상태를 로딩으로 전환
    loader.classList.add('active');
    placeholder.classList.add('hidden');
    pdfViewer.classList.remove('active');
    viewerStatus.textContent = '생성 중...';
    viewerStatus.className = 'status-badge loading';
    generatePdfBtn.disabled = true;

    // 2. 현재 선택된 템플릿과 그에 맞는 데이터 수집
    let payload = {
      templateName: activeTemplate,
      orientation: activeOrientation,
      data: {}
    };

    if (activeTemplate === 'invoice') {
      payload.data = {
        companyName: document.getElementById('inv-company-name').value,
        companySub: document.getElementById('inv-company-sub').value,
        invoiceNumber: document.getElementById('inv-number').value,
        issueDate: document.getElementById('inv-issue-date').value,
        dueDate: document.getElementById('inv-due-date').value,
        customerName: document.getElementById('inv-customer-name').value,
        customerContact: document.getElementById('inv-customer-contact').value,
        customerEmail: document.getElementById('inv-customer-email').value,
        customerAddress: '경기도 성남시 분당구 판교역로 456', // 고정값 처리
        senderName: '홍길동 대표',
        senderAddress: '서울특별시 강남구 테헤란로 123, 7층',
        senderPhone: '02-1234-5678',
        items: invoiceItems.filter(item => item.name.trim() !== '') // 비어있지 않은 항목만 전송
      };
    } else if (activeTemplate === 'monthly_sales') {
      payload.data = {
        reportTitle: document.getElementById('sales-title').value,
        period: document.getElementById('sales-period').value,
        generatedDate: document.getElementById('sales-date').value,
        monthlyData: monthlySalesData
      };
    }

    try {
      // 3. API 요청 전송
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json();
        throw new Error(errJson.error || 'PDF 생성에 실패했습니다.');
      }

      // 4. 응답을 Blob 형태로 받아서 iframe 소스 주소로 변환
      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);
      
      pdfViewer.src = pdfUrl;
      
      // iFrame 로드 완료 후 로딩 마스크 지우기
      pdfViewer.onload = () => {
        loader.classList.remove('active');
        pdfViewer.classList.add('active');
        viewerStatus.textContent = '작성 완료';
        viewerStatus.className = 'status-badge success';
        generatePdfBtn.disabled = false;
      };

    } catch (error) {
      console.error('PDF 요청 실패:', error);
      alert(`PDF 생성 실패: ${error.message}`);
      
      loader.classList.remove('active');
      placeholder.classList.remove('hidden');
      viewerStatus.textContent = '에러';
      viewerStatus.className = 'status-badge';
      generatePdfBtn.disabled = false;
    }
  });
});
