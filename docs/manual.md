# TRON PDF Reporting System 사용 설명서 (User & Developer Manual)

본 문서는 **Node.js, Express, Puppeteer**를 기반으로 구축된 고정밀 서버 사이드 PDF 리포팅 프로그램의 사용 방법과 서식 템플릿 개발 가이드를 제공합니다.

---

## 1. 개요 및 특징

이 시스템은 클라이언트 브라우저의 환경적 한계(폰트 미설치, 브라우저 엔진 차이, 사용자 인쇄 설정 오류 등)를 극복하기 위해 **서버에서 크롬(Headless Chrome)을 띄워 HTML/CSS를 완벽한 A4 규격의 PDF로 구운 뒤 다운로드**하는 방식을 채택하고 있습니다.

*   **크로스 브라우저 일관성:** 모든 디바이스에서 100% 동일한 인쇄 레이아웃 보장.
*   **초정밀 인쇄 제어:** 여백 고정, 강제 페이지 나눔, 테이블 헤더 자동 반복 적용.
*   **유동적인 차트 렌더링:** SVG 벡터 그래픽 차트를 적용하여 인쇄 시 그래프 선이 깨지지 않고 선명하게 출력.
*   **다이나믹 플레이스홀더:** 프론트엔드에서 수정한 JSON 데이터를 서버 템플릿에 실시간 주입.

---

## 2. 설치 및 실행 방법

### 2.1. 사전 준비 (Prerequisites)
*   PC에 **Node.js** (v16 이상 권장)가 설치되어 있어야 합니다.

### 2.2. 프로젝트 설치 및 기동
1.  **의존성 패키지 설치:**
    터미널을 열고 프로젝트 루트 디렉토리(`f:\Project\Reporting`)에서 아래 명령어를 실행하여 필요한 패키지(Express, Puppeteer 등)를 다운로드합니다.
    ```bash
    npm install
    ```
    *(※ Puppeteer 설치 중에 백그라운드용 크롬 바이너리가 함께 다운로드되므로 약 1~2분의 시간이 소요될 수 있습니다.)*

2.  **로컬 서버 실행:**
    설치가 완료되면 서버를 가동합니다.
    ```bash
    npm start
    ```
    서버가 구동되면 콘솔에 다음 메시지가 출력됩니다:
    `PDF Reporting Server is running on: http://localhost:3000`

3.  **브라우저 접속:**
    웹 브라우저를 열고 다음 주소에 접속합니다:
    [http://localhost:3000](http://localhost:3000)

---

## 3. 대시보드 사용 방법

대시보드 UI는 **데이터 에디터(왼쪽)**와 **실시간 미리보기(오른쪽)**로 분할되어 동작합니다.

### 3.1. 화면 테마 지정 (Dark / Light Mode)
*   우측 상단의 **둥근 아이콘(해/달 모양)**을 클릭하면 전체 화면의 스타일이 다크 모드와 라이트 모드로 실시간 토글됩니다. 
*   사용자가 지정한 테마는 브라우저의 `localStorage`에 자동 저장되므로 새로고침을 해도 유지됩니다.

### 3.2. 템플릿 선택 및 데이터 커스텀
*   **1. 리포트 템플릿 선택:** '비즈니스 송장' 또는 '월간 매출 보고서' 탭을 선택합니다.
*   **2. 데이터 상세 설정:** 
    *   **송장(Invoice) 선택 시:** 청구 금액 정보 및 수신자 정보를 기입하고, 하단 테이블에서 `+ 품목 추가` 버튼을 눌러 새 품목을 넣거나 개별 단가, 수량을 편집할 수 있습니다. `X` 버튼을 누르면 품목이 삭제됩니다.
    *   **매출 보고서(Sales Report) 선택 시:** 연월 정보에 따른 매출금액과 목표달성률을 입력할 수 있습니다. 매출액을 수정하면 전월 대비 증감율이 실시간으로 자동 산출됩니다.

### 3.3. PDF 빌드 및 인쇄/다운로드
*   에디터 하단의 **"PDF 리포트 생성 및 조율"** 버튼을 클릭하면 서버로 데이터가 전송되며 Puppeteer 렌더링이 시작됩니다.
*   작성이 완료되면 우측 뷰어 프레임에 최종 인쇄 규격의 PDF 문서가 출력됩니다.
*   PDF 뷰어 내의 브라우저 기본 컨트롤러를 활용하여 **즉시 인쇄(Print)**하거나 **파일로 저장(Download)**할 수 있습니다.

---

## 4. 개발자 가이드 (새 템플릿 추가 및 커스텀)

새로운 형태의 리포트를 시스템에 추가하는 방법은 아래와 같습니다.

### 4.1. Step 1: HTML/CSS 템플릿 작성 (`/templates` 폴더)
새로운 리포트 양식(예: `receipt.html`)을 추가합니다. 인쇄 시 레이아웃이 깨지지 않도록 아래 CSS 표준을 준수해야 합니다.

*   **A4 규격 지정:**
    ```css
    @page {
      size: A4 portrait; /* A4 세로 방향 */
      margin: 25mm 15mm 20mm 15mm; /* 헤더/푸터 영역 공간 확보 */
    }
    ```
*   **테이블 헤더 반복 (표가 2페이지 이상 넘어갈 때):**
    ```css
    thead {
      display: table-header-group;
    }
    ```
*   **행 잘림 방지 (글자의 반만 다음 장으로 넘어가는 현상 제어):**
    ```css
    tr {
      break-inside: avoid;
    }
    ```
*   **강제 페이지 분할 (구역별로 한 페이지씩 나오게 처리):**
    ```css
    .page-break {
      break-before: page;
    }
    ```
*   **데이터 주입 구멍 설정:** 치환될 텍스트 자리에 `{{customerName}}` 처럼 이중 중괄호 플레이스홀더를 작성해 둡니다.

### 4.2. Step 2: 서버 라우터 연동 (`server.js`)
`/api/generate-pdf` API에서 수신된 JSON 데이터 값을 읽어 HTML을 치환하는 로직을 추가합니다.

```javascript
if (templateName === 'receipt') {
  const replacements = {
    customerName: data.customerName,
    paymentAmount: data.amount.toLocaleString(),
    // ... 기타 필요한 치환 변수 매핑
  };
  
  for (const [key, value] of Object.entries(replacements)) {
    htmlContent = htmlContent.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
}
```

### 4.3. Step 3: Puppeteer 머리글/바닥글 활용하기
`server.js`의 `page.pdf()` 옵션에 구현된 `headerTemplate` 및 `footerTemplate`을 수정하여 모든 문서 페이지의 상하단에 날짜, 문서 등급, 페이지 번호(`pageNumber`, `totalPages` 클래스 활용)를 자유롭게 커스터마이징할 수 있습니다.
