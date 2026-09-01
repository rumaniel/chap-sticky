# 업로드 키 만들기 (직접 실행)

CI 가 AAB 에 서명하려면 업로드 키가 필요하다. **이 절차는 사람이 직접 돌린다** —
비밀번호가 대화 기록이나 로그에 남지 않게 하기 위해서다.

솔리테어의 키는 공유하지 않는다. 앱 전용 키를 새로 만들면 유출 시 폭발 반경이
이 앱 하나로 제한되고, mac-mini 러너에 있는 기존 키 파일도 건드리지 않는다.

> Play 앱 서명을 쓰면 **업로드 키는 잃어버려도 재설정할 수 있다.** 구글이 보관하는
> 앱 서명 키가 따로 있기 때문이다. 그래도 재설정은 번거로우니 백업은 해 둔다.

---

## 1. 키 생성

저장소 **바깥**에 만든다. 저장소 안에 두면 실수로 커밋될 수 있다
(`.gitignore` 로 막아두긴 했다).

> **PowerShell 은 `~` 를 확장하지 않는다.** 네이티브 exe 인자로 넘어간 `~` 는
> 문자 그대로 전달돼 `~\keys\...` 라는 존재하지 않는 경로가 된다. 폴더도 미리
> 만들어야 한다 — keytool 은 상위 폴더를 만들어 주지 않는다.

**PowerShell**

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\keys" | Out-Null
```

```powershell
keytool -genkeypair -v -keystore "$env:USERPROFILE\keys\chapsticky-upload.jks" -alias chapsticky -keyalg RSA -keysize 4096 -validity 10000 -storetype PKCS12 -dname "CN=Studio Mangru, O=Studio Mangru, C=KR"
```

**Git Bash / macOS / Linux**

```bash
mkdir -p ~/keys
```

```bash
keytool -genkeypair -v -keystore ~/keys/chapsticky-upload.jks -alias chapsticky -keyalg RSA -keysize 4096 -validity 10000 -storetype PKCS12 -dname "CN=Studio Mangru, O=Studio Mangru, C=KR"
```

- `-validity 10000` ≈ 27년. Play 는 2033년 이후까지 유효한 키를 요구한다.
- `-dname` 을 주면 이름·조직 질문을 건너뛴다. `C=` 는 **두 글자 국가 코드**(`KR`)다.
- 비밀번호는 **저장소 비밀번호와 키 비밀번호 두 개**를 묻는다. 같게 해도 된다.

확인:

```powershell
keytool -list -v -keystore "$env:USERPROFILE\keys\chapsticky-upload.jks" -alias chapsticky
```

`Signature algorithm name: SHA256withRSA` 같은 줄과 유효기간이 보이면 정상이다.

---

## 2. GitHub 에 등록

키 파일은 base64 로 시크릿에 넣는다. 비밀번호는 따로 시크릿, alias 는 공개돼도
무해하므로 변수로 둔다.

**Git Bash (권장)**

```bash
base64 -w0 ~/keys/chapsticky-upload.jks | gh secret set ANDROID_KEYSTORE_BASE64 -R rumaniel/chap-sticky
```

**PowerShell** — `base64` 명령이 없어서 .NET 으로 만든다.

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$env:USERPROFILE\keys\chapsticky-upload.jks")) | gh secret set ANDROID_KEYSTORE_BASE64 -R rumaniel/chap-sticky
```

```bash
gh secret set ANDROID_KEYSTORE_PASSWORD -R rumaniel/chap-sticky
```

```bash
gh secret set ANDROID_KEYALIAS_PASSWORD -R rumaniel/chap-sticky
```

```bash
gh variable set ANDROID_KEYALIAS_NAME -R rumaniel/chap-sticky --body chapsticky
```

macOS 에서는 `base64 -w0` 대신 `base64 -i ~/keys/chapsticky-upload.jks`.
어느 쪽으로 넣어도 된다 — 워크플로가 복호화 전에 개행·CR 을 털어낸다.

Play Console 업로드까지 하려면 두 개가 더 필요하다. 서비스 계정은 **계정 단위**라
솔리테어에서 쓰던 값을 그대로 재사용하면 된다.

```bash
gh variable set PLAY_CONSOLE_PACKAGE_NAME -R rumaniel/chap-sticky --body com.mangru.chapsticky
```

```bash
gh secret set PLAY_CONSOLE_SERVICE_ACCOUNT -R rumaniel/chap-sticky < ~/keys/play-service-account.json
```

등록 결과 확인:

```bash
gh secret list -R rumaniel/chap-sticky && gh variable list -R rumaniel/chap-sticky
```

---

## 3. 백업

**`.jks` 파일 + 두 비밀번호**를 안전한 곳 두 군데에 둔다 (비밀번호 관리자, 암호화한
외장 저장소 등). GitHub 시크릿은 **읽을 수 없다** — 등록 후에는 값을 다시 꺼낼 방법이
없으므로 시크릿을 백업으로 여기면 안 된다.

---

## 4. 빌드 확인

```bash
gh workflow run android-release.yml -R rumaniel/chap-sticky -f publish=false
```

실행 요약에 `서명: true` 가 찍히고 AAB 아티팩트가 올라오면 성공이다.
`publish=true` 는 Play Console 에 앱이 먼저 만들어져 있어야 동작한다
(없으면 edit 생성 단계에서 멈춘다).
