# Stable Diffusion WebUI Forge 이전 및 솔루션 연동 가이드

---

## 1. 폴더 이전 방법

### 주의사항
- `venv` 폴더가 포함되어 있어 단순 복사/붙여넣기로 이전 가능
- 절대경로가 venv 내부에 일부 포함되어 있으므로 이전 후 **venv 재생성** 권장

### 이전 절차

**① 폴더 복사**
```
stable-diffusion-webui-forge\ 폴더 전체를 원하는 경로로 이동
```

**② run_forge.bat도 같은 위치에 복사**
```
run_forge.bat → 새 경로에 함께 이동
```

**③ venv 재생성 (권장)**
```bat
cd /d 새경로\stable-diffusion-webui-forge
rmdir /s /q venv
C:\Users\DESKTOP_1303\AppData\Local\Programs\Python\Python310\python.exe -m venv venv
venv\Scripts\python.exe -u launch.py --xformers --skip-python-version-check --api
```
> 첫 실행 시 패키지 자동 재설치 (10~15분 소요)

---

## 2. 솔루션 연동 구조

```
솔루션 (외부 서버/앱)
        │
        │  HTTP REST API
        ▼
Stable Diffusion Forge (127.0.0.1:7860)
        │
        ▼
   이미지 생성 결과 반환
```

---

## 3. API 기본 정보

| 항목 | 값 |
|------|-----|
| Base URL | `http://127.0.0.1:7860` |
| API 문서 | `http://127.0.0.1:7860/docs` |
| 인증 | 없음 (기본) |
| 데이터 형식 | JSON |
| 이미지 반환 | Base64 인코딩 |

---

## 4. 주요 API 엔드포인트

### 4-1. 이미지 생성 (txt2img)

**요청**
```
POST http://127.0.0.1:7860/sdapi/v1/txt2img
Content-Type: application/json
```

**파라미터**
```json
{
    "prompt": "masterpiece, best quality, 1girl, anime style",
    "negative_prompt": "lowres, bad anatomy, worst quality, blurry",
    "width": 512,
    "height": 768,
    "steps": 28,
    "cfg_scale": 7,
    "sampler_name": "DPM++ 2M Karras",
    "seed": -1,
    "override_settings": {
        "sd_model_checkpoint": "meinamix_v12Final.safetensors"
    }
}
```

**응답**
```json
{
    "images": ["base64_encoded_image_string..."],
    "info": "{ ... 생성 정보 ... }"
}
```

---

### 4-2. 모델 목록 조회

```
GET http://127.0.0.1:7860/sdapi/v1/sd-models
```

**응답 예시**
```json
[
    { "title": "meinamix_v12Final.safetensors", "model_name": "meinamix_v12Final" },
    { "title": "ghostmix_v20Bakedvae.safetensors", "model_name": "ghostmix_v20Bakedvae" }
]
```

---

### 4-3. 생성 진행률 조회

```
GET http://127.0.0.1:7860/sdapi/v1/progress
```

**응답 예시**
```json
{
    "progress": 0.5,
    "eta_relative": 3.2,
    "state": { "sampling_step": 14, "sampling_steps": 28 }
}
```

---

### 4-4. 샘플러 목록 조회

```
GET http://127.0.0.1:7860/sdapi/v1/samplers
```

---

## 5. 코드 예시

### Python
```python
import requests
import base64
from pathlib import Path

SD_URL = "http://127.0.0.1:7860"

def generate_image(prompt: str, save_path: str) -> bool:
    payload = {
        "prompt": prompt,
        "negative_prompt": "lowres, bad anatomy, worst quality, blurry, watermark",
        "width": 512,
        "height": 768,
        "steps": 28,
        "cfg_scale": 7,
        "sampler_name": "DPM++ 2M Karras",
        "seed": -1,
    }

    response = requests.post(f"{SD_URL}/sdapi/v1/txt2img", json=payload)
    if response.status_code != 200:
        return False

    image_data = response.json()["images"][0]
    Path(save_path).write_bytes(base64.b64decode(image_data))
    return True


# 사용 예
generate_image(
    prompt="masterpiece, 1boy, chinese martial arts warrior, sword aura",
    save_path="output.png"
)
```

---

### C# (.NET)
```csharp
using System.Net.Http;
using System.Text;
using System.Text.Json;

public class StableDiffusionClient
{
    private readonly HttpClient _client = new HttpClient();
    private const string BaseUrl = "http://127.0.0.1:7860";

    public async Task<byte[]?> GenerateImageAsync(string prompt)
    {
        var payload = new
        {
            prompt = prompt,
            negative_prompt = "lowres, bad anatomy, worst quality, blurry",
            width = 512,
            height = 768,
            steps = 28,
            cfg_scale = 7,
            sampler_name = "DPM++ 2M Karras",
            seed = -1
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var response = await _client.PostAsync($"{BaseUrl}/sdapi/v1/txt2img", content);

        if (!response.IsSuccessStatusCode) return null;

        var result = JsonSerializer.Deserialize<JsonElement>(
            await response.Content.ReadAsStringAsync()
        );
        var base64 = result.GetProperty("images")[0].GetString();
        return Convert.FromBase64String(base64!);
    }
}
```

---

## 6. 서버 실행/종료

### 실행
```bat
run_forge.bat 더블클릭
또는
cmd /c run_forge.bat
```

### 종료
```
작업 관리자 → python.exe 종료
또는
taskkill /f /im python.exe
```

### 실행 확인
```
http://127.0.0.1:7860/sdapi/v1/sd-models 접속 → 200 OK 이면 정상
```

---

## 7. 모델 추가 방법

1. civitai.com에서 `.safetensors` 파일 다운로드
2. 아래 폴더에 복사
```
stable-diffusion-webui-forge\models\Stable-diffusion\
```
3. API로 모델 목록 새로고침
```
POST http://127.0.0.1:7860/sdapi/v1/refresh-checkpoints
```

---

## 8. 포트 변경 방법

다른 포트를 사용하려면 `run_forge.bat`에서 수정:
```bat
venv\Scripts\python.exe -u launch.py --xformers --skip-python-version-check --api --port 8080
```

---

## 9. 외부 IP 허용 (다른 PC에서 접근)

```bat
venv\Scripts\python.exe -u launch.py --xformers --skip-python-version-check --api --listen
```
> 접속 주소: `http://서버IP:7860`  
> 방화벽에서 7860 포트 허용 필요
