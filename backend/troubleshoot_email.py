"""
이메일 인증코드 전송 문제 트러블슈팅 스크립트
종합적인 진단 및 테스트 도구
"""
import sys
import os
import smtplib
from pathlib import Path
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

# 프로젝트 루트를 Python 경로에 추가
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

print("=" * 70)
print("이메일 인증코드 전송 문제 트러블슈팅")
print("=" * 70)
print()

# 1. .env 파일 확인
print("[1단계] .env 파일 확인")
print("-" * 70)
env_path = Path(__file__).parent / '.env'
print(f"경로: {env_path}")
print(f"존재 여부: {'✓ 존재함' if env_path.exists() else '✗ 없음'}")

if env_path.exists():
    print(f"파일 크기: {env_path.stat().st_size} bytes")
    # .env 파일 내용 확인 (비밀번호는 마스킹)
    with open(env_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        print(f"총 라인 수: {len(lines)}")
        print("\n.env 파일 내용 (비밀번호 마스킹):")
        for i, line in enumerate(lines, 1):
            line = line.strip()
            if not line or line.startswith('#'):
                print(f"  {i}: {line}")
            elif 'PASSWORD' in line.upper():
                parts = line.split('=', 1)
                if len(parts) == 2:
                    key, value = parts
                    masked = '*' * min(len(value), 20) if value else '(empty)'
                    print(f"  {i}: {key}={masked}")
                else:
                    print(f"  {i}: {line}")
            else:
                print(f"  {i}: {line}")
else:
    print("\n⚠ 경고: .env 파일이 없습니다!")
    print("  backend/.env 파일을 생성하고 다음 설정을 추가하세요:")
    print()
    print("  SMTP_HOST=smtp.gmail.com")
    print("  SMTP_PORT=587")
    print("  SMTP_USERNAME=your-email@gmail.com")
    print("  SMTP_PASSWORD=your-app-password")
    print("  SMTP_FROM_EMAIL=your-email@gmail.com")
    print("  SMTP_FROM_NAME=여유")
    print()

print()

# 2. 환경 변수 로드 및 확인
print("[2단계] 환경 변수 로드 및 확인")
print("-" * 70)
load_dotenv(dotenv_path=env_path)

SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT_STR = os.getenv("SMTP_PORT", "").strip()
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "").strip()
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "").strip()
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "").strip()

try:
    SMTP_PORT = int(SMTP_PORT_STR) if SMTP_PORT_STR else 0
except ValueError:
    SMTP_PORT = 0

print(f"SMTP_HOST: {SMTP_HOST if SMTP_HOST else '✗ 설정되지 않음'}")
print(f"SMTP_PORT: {SMTP_PORT if SMTP_PORT else '✗ 설정되지 않음'}")
print(f"SMTP_USERNAME: {SMTP_USERNAME if SMTP_USERNAME else '✗ 설정되지 않음'}")
print(f"SMTP_PASSWORD: {'✓ 설정됨 (' + str(len(SMTP_PASSWORD)) + '자)' if SMTP_PASSWORD else '✗ 설정되지 않음'}")
print(f"SMTP_FROM_EMAIL: {SMTP_FROM_EMAIL if SMTP_FROM_EMAIL else '⚠ 설정되지 않음 (SMTP_USERNAME 사용)'}")
print(f"SMTP_FROM_NAME: {SMTP_FROM_NAME if SMTP_FROM_NAME else '⚠ 설정되지 않음 (기본값 사용)'}")

# 설정 완료 여부 확인
config_issues = []
if not SMTP_HOST:
    config_issues.append("SMTP_HOST가 설정되지 않았습니다")
if not SMTP_PORT:
    config_issues.append("SMTP_PORT가 설정되지 않았습니다")
if not SMTP_USERNAME:
    config_issues.append("SMTP_USERNAME이 설정되지 않았습니다")
if not SMTP_PASSWORD:
    config_issues.append("SMTP_PASSWORD가 설정되지 않았습니다")

if config_issues:
    print("\n✗ 설정 문제 발견:")
    for issue in config_issues:
        print(f"  - {issue}")
    print("\n다음 단계로 진행할 수 없습니다. .env 파일을 확인하세요.")
    sys.exit(1)
else:
    print("\n✓ 모든 필수 설정이 완료되었습니다!")

print()

# 3. SMTP 서버 연결 테스트
print("[3단계] SMTP 서버 연결 테스트")
print("-" * 70)
print(f"연결 시도: {SMTP_HOST}:{SMTP_PORT}")

try:
    if SMTP_PORT == 465:
        print("SSL 연결 사용 (포트 465)")
        server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=10)
        print("✓ SSL 연결 성공")
    else:
        print(f"TLS 연결 사용 (포트 {SMTP_PORT})")
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        print("✓ SMTP 서버 연결 성공")
        server.starttls()
        print("✓ TLS 핸드셰이크 성공")
except smtplib.SMTPConnectError as e:
    print(f"✗ SMTP 서버 연결 실패: {e}")
    print("\n가능한 원인:")
    print("  1. 네트워크 연결 문제")
    print("  2. SMTP_HOST 주소가 잘못됨")
    print("  3. 방화벽이 포트를 차단함")
    print("  4. SMTP 서버가 다운됨")
    sys.exit(1)
except Exception as e:
    print(f"✗ 연결 중 오류 발생: {e}")
    import traceback
    print(traceback.format_exc())
    sys.exit(1)

print()

# 4. SMTP 인증 테스트
print("[4단계] SMTP 인증 테스트")
print("-" * 70)
print(f"사용자명: {SMTP_USERNAME}")
print(f"비밀번호 길이: {len(SMTP_PASSWORD)}자")

try:
    # 비밀번호의 공백 제거
    smtp_password = SMTP_PASSWORD.replace(' ', '')
    server.login(SMTP_USERNAME, smtp_password)
    print("✓ SMTP 인증 성공!")
except smtplib.SMTPAuthenticationError as e:
    print(f"✗ SMTP 인증 실패: {e}")
    print("\n가능한 원인:")
    print("  1. SMTP_USERNAME 또는 SMTP_PASSWORD가 잘못됨")
    print("  2. Gmail의 경우 일반 비밀번호 대신 앱 비밀번호를 사용해야 함")
    print("  3. 2단계 인증이 활성화되지 않음 (Gmail)")
    print("\n해결 방법:")
    print("  Gmail 사용 시:")
    print("  1. Google 계정 설정 > 보안 > 2단계 인증 활성화")
    print("  2. https://myaccount.google.com/apppasswords 에서 앱 비밀번호 생성")
    print("  3. 생성된 16자리 앱 비밀번호를 SMTP_PASSWORD에 설정")
    server.quit()
    sys.exit(1)
except Exception as e:
    print(f"✗ 인증 중 오류 발생: {e}")
    import traceback
    print(traceback.format_exc())
    server.quit()
    sys.exit(1)

print()

# 5. 이메일 전송 테스트
print("[5단계] 이메일 전송 테스트")
print("-" * 70)

# 테스트 이메일 주소 입력
test_email = input("테스트 이메일 주소를 입력하세요 (Enter로 건너뛰기): ").strip()

if not test_email:
    print("테스트 이메일 전송을 건너뜁니다.")
    server.quit()
    print("\n" + "=" * 70)
    print("✓ 모든 테스트 통과! 이메일 설정이 정상적으로 작동합니다.")
    print("=" * 70)
    sys.exit(0)

# 이메일 주소 형식 검증
import re
email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
if not re.match(email_pattern, test_email):
    print(f"✗ 잘못된 이메일 주소 형식: {test_email}")
    server.quit()
    sys.exit(1)

print(f"테스트 이메일 전송: {test_email}")

try:
    # 이메일 메시지 생성
    msg = MIMEMultipart('alternative')
    msg['Subject'] = "[테스트] 이메일 인증코드"
    from_email = SMTP_FROM_EMAIL if SMTP_FROM_EMAIL else SMTP_USERNAME
    msg['From'] = f"{SMTP_FROM_NAME} <{from_email}>"
    msg['To'] = test_email
    
    # 테스트 인증코드
    test_code = "123456"
    
    # HTML 본문
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body>
        <h2>이메일 인증 테스트</h2>
        <p>이것은 이메일 전송 테스트입니다.</p>
        <div style="background-color: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold;">
            인증코드: {test_code}
        </div>
        <p>이 이메일을 받았다면 SMTP 설정이 정상적으로 작동하는 것입니다.</p>
    </body>
    </html>
    """
    
    # 텍스트 본문
    text_body = f"""
이메일 인증 테스트

인증코드: {test_code}

이것은 이메일 전송 테스트입니다.
이 이메일을 받았다면 SMTP 설정이 정상적으로 작동하는 것입니다.
    """
    
    text_part = MIMEText(text_body, 'plain', 'utf-8')
    html_part = MIMEText(html_body, 'html', 'utf-8')
    msg.attach(text_part)
    msg.attach(html_part)
    
    # 이메일 전송
    server.send_message(msg)
    print(f"✓ 테스트 이메일 전송 성공!")
    print(f"  수신자: {test_email}")
    print(f"  발신자: {from_email}")
    print(f"  제목: [테스트] 이메일 인증코드")
    print("\n이메일을 확인하세요. 받지 못했다면 스팸함을 확인하세요.")
    
except smtplib.SMTPRecipientsRefused as e:
    print(f"✗ 수신자 주소 거부: {e}")
    print("  이메일 주소를 확인하세요.")
except smtplib.SMTPDataError as e:
    print(f"✗ 이메일 데이터 오류: {e}")
    print("  이메일 내용에 문제가 있을 수 있습니다.")
except Exception as e:
    print(f"✗ 이메일 전송 중 오류 발생: {e}")
    import traceback
    print(traceback.format_exc())
finally:
    server.quit()

print()
print("=" * 70)
print("트러블슈팅 완료")
print("=" * 70)

