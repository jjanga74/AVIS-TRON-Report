# TRON PDF Reporting Service 외부 연동 규격서 (API Integration Manual)

본 문서는 타 시스템(외부 웹 애플리케이션, 레거시 백엔드, 타 마이크로서비스 등)에서 **TRON PDF Reporting Service**를 연동하여 고정밀 PDF 파일을 생성 및 다운로드하기 위한 REST API 규격과 주요 개발 언어별 연동 예제를 제공합니다.

---

## 1. API 호출 규격 (HTTP Request Specification)

외부 시스템은 PDF 서버가 노출하는 아래의 범용 HTML-to-PDF 변환 API를 호출하여 즉석에서 빌드된 PDF 바이너리(Stream)를 수신할 수 있습니다.

### 1.1. 엔드포인트 정보
*   **URL:** `http://<PDF_SERVER_IP>:3000/api/generate-pdf-from-html`
*   **Method:** `POST`
*   **Content-Type:** `application/json`

### 1.2. 요청 바디 (Request Body JSON)
```json
{
  "html": "string",
  "title": "string",
  "style": "string"
}
```

| 파라미터명 | 타입 | 필수 여부 | 설명 |
| :--- | :--- | :--- | :--- |
| **html** | String | **필수 (Required)** | PDF 본문 영역에 렌더링할 순수 HTML 마크업 문자열 (예: `<table>...</table>`) |
| **title** | String | 선택 (Optional) | 문서 상단 머리글(Header) 및 다운로드 파일명에 매핑할 리포트의 제목 |
| **style** | String | 선택 (Optional) | 본문 HTML에 결합할 전역 CSS 스타일시트 (Tailwind CSS 컴파일 결과물 또는 커스텀 디자인 규칙) |

### 1.3. 응답 규격 (Response Specification)
*   **성공 시 (Status 200 OK):**
    *   **Content-Type:** `application/pdf`
    *   **Body:** PDF 바이너리 스트림 (Binary Buffer)
*   **실패 시 (Status 400 / 500):**
    *   **Content-Type:** `application/json`
    *   **Body:** 에러 메시지 객체 (예: `{"error": "인쇄할 HTML 내용(html)이 없습니다."}`)

---

## 2. 언어별 연동 예제 (Code Examples)

### 2.1. JavaScript (Fetch API - 클라이언트 브라우저 직접 호출)
React, Vue, Angular 또는 바닐라 자바스크립트 환경에서 직접 API를 호출하여 사용자 화면에서 즉시 인쇄/다운로드 처리하는 코드입니다.

```javascript
async function downloadServerPDF(elementId, docTitle) {
  const targetElement = document.getElementById(elementId);
  if (!targetElement) return alert("대상 요소를 찾을 수 없습니다.");

  // 현재 브라우저에 활성화된 스타일 태그(CSS) 취합
  const styleTags = Array.from(document.querySelectorAll('style'));
  const compiledStyles = styleTags.map(tag => tag.innerHTML).join('\n');

  try {
    const response = await fetch('http://localhost:3000/api/generate-pdf-from-html', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: targetElement.outerHTML,
        title: docTitle,
        style: compiledStyles
      })
    });

    if (!response.ok) throw new Error("PDF 생성 서버 통신 오류");

    const pdfBlob = await response.blob();
    const blobUrl = URL.createObjectURL(pdfBlob);

    // 다운로드 트리거
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${docTitle}_${new Date().toISOString().slice(0, 10)}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
    
  } catch (error) {
    console.error("PDF 생성 에러:", error);
  }
}
```

### 2.2. Java (Spring Boot - RestTemplate / WebClient 백엔드 호출)
서버 백엔드 간 통신을 거쳐 PDF 바이너리를 내려받아 로컬 파일로 디스크에 저장하거나 컨트롤러를 통해 브라우저로 중계(Proxy)하는 방식입니다.

```java
import org.springframework.http.*;
import org.springframework.web.client.RestTemplate;
import java.io.FileOutputStream;
import java.util.HashMap;
import java.util.Map;

public class PdfIntegrationService {

    public void generateAndSavePdf(String htmlContent, String docTitle) {
        String url = "http://localhost:3000/api/generate-pdf-from-html";
        RestTemplate restTemplate = new RestTemplate();

        // 헤더 설정
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        // 요청 바디 빌드
        Map<String, String> requestBody = new HashMap<>();
        requestBody.put("html", htmlContent);
        requestBody.put("title", docTitle);
        requestBody.put("style", "table { border: 1px solid black; }"); // 필요시 커스텀 스타일 기입

        HttpEntity<Map<String, String>> request = new HttpEntity<>(requestBody, headers);

        try {
            // API 호출 및 바이너리 획득
            ResponseEntity<byte[]> response = restTemplate.exchange(
                    url, HttpMethod.POST, request, byte[].class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                // PDF 파일 저장
                try (FileOutputStream fos = new FileOutputStream(docTitle + ".pdf")) {
                    fos.write(response.getBody());
                    System.out.println("PDF 저장 완료: " + docTitle + ".pdf");
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
```

### 2.3. C# / .NET Core (HttpClient 백엔드 호출)
.NET 컨트롤러단에서 HttpClient를 호출하여 PDF를 조회하는 대표적인 백엔드 연동 방식입니다.

```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using System.IO;

public class PdfExporter
{
    private static readonly HttpClient client = new HttpClient();

    public async Task ExportPdfAsync(string html, string title)
    {
        var url = "http://localhost:3000/api/generate-pdf-from-html";
        var payload = new
        {
            html = html,
            title = title,
            style = "body { margin: 10px; }"
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        try
        {
            var response = await client.PostAsync(url, content);
            if (response.IsSuccessStatusCode)
            {
                byte[] pdfBytes = await response.Content.ReadAsByteArrayAsync();
                await File.WriteAllBytesAsync($"{title}.pdf", pdfBytes);
                Console.WriteLine($"PDF 파일이 성공적으로 기록되었습니다: {title}.pdf");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"PDF API 오류: {ex.Message}");
        }
    }
}
```

### 2.4. Python (Requests Library)
데이터 과학이나 배치 스케줄러 배치 처리 작업 시 가장 단순하게 인쇄 명령을 내릴 수 있는 파이썬 코드 예제입니다.

```python
import requests

def generate_pdf(html_markup, title):
    url = "http://localhost:3000/api/generate-pdf-from-html"
    headers = {"Content-Type": "application/json"}
    payload = {
        "html": html_markup,
        "title": title,
        "style": "h1 { color: darkblue; }"
    }
    
    try:
        response = requests.post(url, json=payload, headers=headers)
        if response.status_code == 200:
            with open(f"{title}.pdf", "wb") as f:
                f.write(response.content)
            print(f"PDF 파일 저장 성공: {title}.pdf")
        else:
            print(f"에러 발생: {response.json()}")
    except Exception as e:
        print(f"서버 연결 실패: {e}")
```

---

## 3. 외부 연동 시 권장 사항 (Best Practices)

1.  **네트워크 보안 및 CORS 관리:**
    *   인프라 내부 망(LAN/VPC) 내에서 마이크로서비스 간 통신을 할 때는 프론트엔드를 거치지 않고 **백엔드 서버끼리 직접 통신**하는 것을 권장합니다. (브라우저 CORS 정책을 고민할 필요가 없어 보안상 매우 안전합니다.)
2.  **리소스 대기 시간 분리:**
    *   PDF 생성 작업은 다른 DB 조회 요청에 비해 CPU 부하가 크므로, 서버에 `Keep-Alive` 헤더 및 HTTP 타임아웃 제한 시간을 **최소 10초 이상** 넉넉하게 보장해 주어야 합니다.
3.  **임시 파일/도메인 관리:**
    *   클라이언트에서 발급한 `URL.createObjectURL(blob)`로 열린 탭은 인쇄가 완료되거나 모달 창이 닫힐 때 브라우저의 가비지 컬렉션을 위해 반드시 `URL.revokeObjectURL(url)`을 실행하여 메모리 누수를 원천 차단하십시오.
