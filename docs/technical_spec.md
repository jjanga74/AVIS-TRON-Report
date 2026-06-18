# AVIS-TRON PDF Reporting Service 기술 설계서 (Technical Specification)

본 문서는 **AVIS-TRON PDF Reporting Service**의 아키텍처, 컴포넌트 설계, 성능 최적화 모델 및 배포 가이드를 서술하는 핵심 개발자 기술 문서입니다.

---

## 1. 아키텍처 및 동작 모델 (System Architecture)

### 1.1. 런타임 구성 및 프로세스 흐름
본 시스템은 초정밀 무손실 벡터 PDF를 생성하기 위해 백엔드와 크롬 헤드리스 프로세스를 분리하여 관리합니다.

```
+---------------------------+             1. HTTP POST (HTML + CSS)
|    React 웹 애플리케이션   | --------------------------------------------+
+---------------------------+                                             |
              ^                                                           v
      4. PDF 바이너리 반환                                 +------------------------------+
              |                                            |    PDF Reporting Service     |
              +------------------------------------------- |       (Express Server)       |
                                                           +------------------------------+
                                                                     |            ^
                                                      2. 탭 개설     |            | 3. PDF 버퍼 반환
                                                      (newPage)      v            |
                                                           +------------------------------+
                                                           |   Headless Chromium Browser  |
                                                           |     (Singleton Instance)     |
                                                           +------------------------------+
```

### 1.2. 싱글톤 브라우저 관리 (Singleton Browser Instance)
*   **배경:** Puppeteer는 실행 시 크롬 브라우저 프로세스를 기동하므로 약 150MB~200MB의 물리 메모리와 상당한 CPU 주기를 소모합니다. 매 요청마다 브라우저를 켜고 끄는 방식은 동시성 요청이 들어왔을 때 서버 장애를 유발합니다.
*   **설계:** 서버 구동(`server.js`)과 동시에 글로벌 스코프에 브라우저 프로세스를 실행하여 대기 상태(Warm-up)로 상주시키고, API 라우터에서는 상주하고 있는 브라우저에서 가상의 탭(`page = await browser.newPage()`)만 생성하여 인쇄를 실행한 후 탭만 파괴(`page.close()`)합니다.
*   **속도 개선:** 브라우저 기동 단계(약 1.5 ~ 2.5초 소요)가 생략되므로 순수 HTML 컴파일 및 PDF 렌더링에만 **0.3 ~ 0.5초** 내외의 빠른 응답 속도를 보여줍니다.

---

## 2. 핵심 기술 스펙 (Core Components)

### 2.1. 동적 스타일시트(Tailwind CSS) 주입 엔진
클라이언트에서 컴포넌트 마크업을 단순 추출하면 전역 스타일시트가 유실되므로, 다음과 같은 방식으로 스타일 복원을 보장합니다.

1.  **클라이언트 스타일 수집 (Client-Side):**
    ```typescript
    const styleTags = Array.from(document.querySelectorAll('style'));
    const compiledStyles = styleTags.map(tag => tag.innerHTML).join('\n');
    ```
    이 코드는 Vite가 브라우저 head에 주입한 모듈형 스타일(CSS) 및 Tailwind 유틸리티 클래스 정보를 전부 평탄화된 문자열로 취합합니다.
2.  **서버 사이드 병합 (Server-Side):**
    수신된 CSS 데이터는 서버 템플릿의 `<head>` 영역 가장 하단에 동적으로 임베드되어, CSS 우선순위(Specificity) 규칙에 의해 원본 리액트 테마와 동일한 색상, 패딩, 테두리가 완벽히 적용됩니다.

### 2.2. 인쇄 제어용 Paged Media CSS 표준 명세
Puppeteer 엔진이 문서를 나눌 때 활용하는 특수 CSS 규칙은 다음과 같이 설정되어 있습니다.

*   `@page { size: A4 portrait; margin: 25mm 15mm 20mm 15mm; }` (세로 모드) / `@page { size: A4 landscape; margin: 25mm 15mm 20mm 15mm; }` (가로 모드)
    인쇄 방향에 맞추어 `@page` 규칙의 크기 설정을 동적으로 변경하고, `<body>` 태그에 `landscape` 클래스를 주입합니다. 이를 통해 CSS 레벨에서 가로 방향 전용 레이아웃을 반응형으로 정의할 수 있습니다.
*   `thead { display: table-header-group; }`
    긴 테이블 데이터가 인쇄 용지를 넘어설 때 다음 페이지의 맨 위에 컬럼 제목줄을 자동으로 반복 렌더링해 줍니다.
*   `tr { break-inside: avoid; }`
    테이블 행(`<tr>`) 안의 텍스트가 여러 줄일 때 행의 경계선이 용지 경계에 걸쳐 상하로 쪼개지는 현상을 방지합니다.

---

## 3. 프로덕션 환경 권장 사항 (Production & Scaling Guide)

### 3.1. 고성능 동시성 처리를 위한 커넥션 풀링 (Browser Pooling)
*   현재 구현된 싱글톤 브라우저 모델은 단일 채널 서비스에 효과적이나, 수백 명의 동시 사용자가 있는 SaaS 환경에서는 하나의 브라우저 인스턴스가 탭 개설 한계에 도달해 렌더링 지연이 발생할 수 있습니다.
*   SaaS 상용 프로덕션 환경에서는 `generic-pool` 라이브러리를 사용해 3~5개의 Headless Chrome 인스턴스를 커넥션 풀(Connection Pool) 형태로 관리하는 아키텍처로 스케일아웃 하는 것을 권장합니다.

### 3.2. Docker 컨테이너 배포 (Dockerfile 가이드)
헤드리스 크롬은 리눅스 컨테이너 배포 시 라이브러리 의존성(libx11, libxcomposite 등)이 없으면 실행되지 않습니다. 다음은 정상 빌드를 보장하는 Dockerfile 구성 예제입니다.

```dockerfile
FROM node:18-slim

# 크롬 구동에 필요한 최소 리눅스 의존성 패키지 설치
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000
# 백그라운드 크롬 실행을 위해 no-sandbox 옵션 필수
CMD ["node", "server.js"]
```

### 3.3. 서버 하드웨어 리소스 산정 (Resource Estimation)
*   **메모리:** Headless Chrome은 페이지당 약 60MB~120MB의 메모리를 사용하므로 최소 **2GB RAM** 이상의 환경을 갖춰야 합니다.
*   **CPU:** PDF 인코딩 및 렌더링 단계에서 일시적으로 CPU 부하가 집중되므로 멀티코어 환경(최소 **2 Core**)이 적극 권장됩니다.
