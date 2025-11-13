"""
이메일 발송 유틸리티
SMTP를 사용하여 인증코드 이메일 발송
"""
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from app.core.config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USERNAME,
    SMTP_PASSWORD,
    SMTP_FROM_EMAIL,
    SMTP_FROM_NAME
)


def _reload_smtp_config():
    """
    런타임에 환경 변수를 다시 확인하여 로드
    모듈 import 시점과 실제 사용 시점의 환경 변수가 다를 수 있음
    """
    from dotenv import load_dotenv
    from pathlib import Path
    
    # .env 파일 다시 로드 시도
    possible_paths = [
        Path(__file__).parent.parent.parent / '.env',
        Path.cwd() / '.env',
        Path.cwd() / 'backend' / '.env',
    ]
    
    for path in possible_paths:
        if path.exists():
            load_dotenv(dotenv_path=path, override=True)
            print(f"[Email] Reloaded .env from: {path.absolute()}")
            break
    
    # 환경 변수 직접 확인
    port_str = os.getenv("SMTP_PORT", "").strip()
    try:
        port = int(port_str) if port_str else SMTP_PORT
    except (ValueError, AttributeError):
        port = SMTP_PORT
    
    return {
        'host': os.getenv("SMTP_HOST", "").strip() or SMTP_HOST,
        'port': port,
        'username': os.getenv("SMTP_USERNAME", "").strip() or SMTP_USERNAME,
        'password': os.getenv("SMTP_PASSWORD", "").strip() or SMTP_PASSWORD,
        'from_email': os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_FROM_EMAIL or SMTP_USERNAME,
        'from_name': os.getenv("SMTP_FROM_NAME", "").strip() or SMTP_FROM_NAME,
    }


def send_verification_email(
    to_email: str,
    verification_code: str,
    username: Optional[str] = None
) -> bool:
    """
    인증코드 이메일 발송
    
    Args:
        to_email: 수신자 이메일 주소
        verification_code: 인증코드 (6자리 숫자 또는 토큰)
        username: 사용자 이름 (선택적)
    
    Returns:
        bool: 발송 성공 여부
    """
    # 런타임에 환경 변수 다시 확인 (모듈 로드 시점과 다를 수 있음)
    print(f"[Email] ===== Email Sending Debug Info =====")
    print(f"[Email] Checking runtime environment variables...")
    runtime_config = _reload_smtp_config()
    
    # 런타임 설정 우선 사용, 없으면 모듈 레벨 설정 사용
    smtp_host = runtime_config['host'] or SMTP_HOST
    smtp_port = runtime_config['port'] or SMTP_PORT
    smtp_username = runtime_config['username'] or SMTP_USERNAME
    smtp_password = runtime_config['password'] or SMTP_PASSWORD
    smtp_from_email = runtime_config['from_email'] or SMTP_FROM_EMAIL
    smtp_from_name = runtime_config['from_name'] or SMTP_FROM_NAME
    
    print(f"[Email] SMTP_HOST: {smtp_host}")
    print(f"[Email] SMTP_PORT: {smtp_port}")
    print(f"[Email] SMTP_USERNAME: {smtp_username if smtp_username else '(empty)'}")
    print(f"[Email] SMTP_PASSWORD: {'SET (' + str(len(smtp_password)) + ' chars)' if smtp_password else '(empty)'}")
    print(f"[Email] SMTP_FROM_EMAIL: {smtp_from_email if smtp_from_email else '(empty)'}")
    print(f"[Email] SMTP_FROM_NAME: {smtp_from_name}")
    
    # 모듈 레벨 설정과 런타임 설정 비교
    if smtp_username != SMTP_USERNAME or smtp_password != SMTP_PASSWORD:
        print(f"[Email] ⚠ WARNING: Runtime config differs from module-level config!")
        print(f"[Email]   Module SMTP_USERNAME: {SMTP_USERNAME if SMTP_USERNAME else '(empty)'}")
        print(f"[Email]   Runtime SMTP_USERNAME: {smtp_username if smtp_username else '(empty)'}")
        print(f"[Email]   Using runtime configuration")
    
    print(f"[Email] =====================================")
    
    if not smtp_username or not smtp_password:
        print(f"[Email] ✗ ERROR: SMTP credentials not configured!")
        print(f"[Email]   SMTP_USERNAME: {'SET' if smtp_username else 'NOT SET'}")
        print(f"[Email]   SMTP_PASSWORD: {'SET' if smtp_password else 'NOT SET'}")
        print(f"[Email]   Please check your .env file in the backend directory")
        print(f"[Email]   Run 'GET /api/auth/debug/email-config' to diagnose")
        return False
    
    if not smtp_host:
        print(f"[Email] ✗ ERROR: SMTP_HOST not configured!")
        return False
    
    try:
        # 이메일 내용 생성
        subject = "이메일 인증 코드"
        
        # HTML 이메일 본문
        html_body = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    line-height: 1.6;
                    color: #333;
                    max-width: 600px;
                    margin: 0 auto;
                    padding: 20px;
                }}
                .container {{
                    background-color: #f9f9f9;
                    border-radius: 10px;
                    padding: 30px;
                    margin: 20px 0;
                }}
                .header {{
                    text-align: center;
                    color: #39489A;
                    margin-bottom: 30px;
                }}
                .code-box {{
                    background-color: #ffffff;
                    border: 2px solid #39489A;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 30px 0;
                }}
                .code {{
                    font-size: 32px;
                    font-weight: bold;
                    color: #39489A;
                    letter-spacing: 5px;
                    font-family: 'Courier New', monospace;
                }}
                .footer {{
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #ddd;
                    font-size: 12px;
                    color: #666;
                    text-align: center;
                }}
                .warning {{
                    background-color: #fff3cd;
                    border-left: 4px solid #ffc107;
                    padding: 15px;
                    margin: 20px 0;
                    border-radius: 4px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>이메일 인증</h1>
                </div>
                
                <p>안녕하세요{f', {username}님' if username else ''},</p>
                
                <p>회원가입을 완료하기 위해 아래 인증코드를 입력해주세요.</p>
                
                <div class="code-box">
                    <div class="code">{verification_code}</div>
                </div>
                
                <div class="warning">
                    <strong>주의사항:</strong>
                    <ul style="margin: 10px 0; padding-left: 20px;">
                        <li>이 인증코드는 3분 후 만료됩니다.</li>
                        <li>본인이 요청하지 않은 경우 이 이메일을 무시하세요.</li>
                        <li>인증코드는 타인에게 공유하지 마세요.</li>
                    </ul>
                </div>
                
                <p>인증코드를 입력하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.</p>
                
                <div class="footer">
                    <p>이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.</p>
                    <p>&copy; 2025 여유. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # 텍스트 이메일 본문 (HTML을 지원하지 않는 클라이언트용)
        text_body = f"""
이메일 인증

안녕하세요{f', {username}님' if username else ''},

회원가입을 완료하기 위해 아래 인증코드를 입력해주세요.

인증코드: {verification_code}

주의사항:
- 이 인증코드는 3분 후 만료됩니다.
- 본인이 요청하지 않은 경우 이 이메일을 무시하세요.
- 인증코드는 타인에게 공유하지 마세요.

인증코드를 입력하지 않으셨다면, 이 이메일을 무시하셔도 됩니다.

---
이 이메일은 자동으로 발송되었습니다. 회신하지 마세요.
© 2025 여유. All rights reserved.
        """
        
        # 이메일 메시지 생성
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f"{smtp_from_name} <{smtp_from_email}>"
        msg['To'] = to_email
        
        # 텍스트 및 HTML 본문 추가
        text_part = MIMEText(text_body, 'plain', 'utf-8')
        html_part = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(text_part)
        msg.attach(html_part)
        
        # SMTP 서버 연결 및 이메일 발송
        print(f"[Email] Connecting to SMTP server: {smtp_host}:{smtp_port}")
        print(f"[Email] From: {smtp_from_email} ({smtp_from_name})")
        print(f"[Email] To: {to_email}")
        
        # 비밀번호의 공백 제거 (일부 서비스의 앱 비밀번호에 공백이 포함될 수 있음)
        clean_password = smtp_password.replace(' ', '')
        
        server = None
        try:
            if smtp_port == 465:
                # SSL 사용
                print(f"[Email] Using SSL connection (port 465)")
                server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
                print(f"[Email] ✓ SSL connection established")
            else:
                # TLS 사용
                print(f"[Email] Using TLS connection (port {smtp_port})")
                server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
                print(f"[Email] ✓ SMTP connection established")
                server.starttls()
                print(f"[Email] ✓ TLS handshake completed")
        except smtplib.SMTPConnectError as conn_error:
            print(f"[Email] ✗ SMTP Connection Error!")
            print(f"[Email]   Could not connect to {smtp_host}:{smtp_port}")
            print(f"[Email]   Error: {conn_error}")
            print(f"[Email]   Possible causes:")
            print(f"[Email]     1. Network connectivity issues")
            print(f"[Email]     2. Incorrect SMTP_HOST or SMTP_PORT")
            print(f"[Email]     3. Firewall blocking the port")
            print(f"[Email]     4. SMTP server is down")
            raise
        except Exception as conn_error:
            print(f"[Email] ✗ Connection Error: {conn_error}")
            raise
        
        # 로그인
        print(f"[Email] Attempting to login as {smtp_username}")
        print(f"[Email] Password length: {len(clean_password)} characters")
        try:
            server.login(smtp_username, clean_password)
            print(f"[Email] ✓ Successfully logged in to SMTP server")
        except smtplib.SMTPAuthenticationError as auth_error:
            print(f"[Email] ✗ Authentication failed!")
            print(f"[Email]   Error: {auth_error}")
            print(f"[Email]   Possible causes:")
            print(f"[Email]     1. Incorrect SMTP_USERNAME or SMTP_PASSWORD")
            print(f"[Email]     2. For Gmail: Must use App Password, not regular password")
            print(f"[Email]     3. 2-Step Verification not enabled (Gmail)")
            print(f"[Email]   Solutions:")
            print(f"[Email]     - Gmail: Enable 2-Step Verification and create App Password")
            print(f"[Email]     - Get App Password: https://myaccount.google.com/apppasswords")
            print(f"[Email]     - Run 'python troubleshoot_email.py' for detailed diagnosis")
            raise
        
        # 이메일 발송
        print(f"[Email] Sending email to {to_email}...")
        try:
            server.send_message(msg)
            print(f"[Email] ✓ Email message sent successfully")
        except smtplib.SMTPRecipientsRefused as e:
            print(f"[Email] ✗ Recipient address refused: {e}")
            print(f"[Email]   The email address '{to_email}' may be invalid or rejected")
            raise
        except smtplib.SMTPDataError as e:
            print(f"[Email] ✗ SMTP Data Error: {e}")
            print(f"[Email]   The email content may be rejected by the server")
            raise
        except Exception as send_error:
            print(f"[Email] ✗ Failed to send email message: {send_error}")
            print(f"[Email]   Error type: {type(send_error).__name__}")
            raise
        
        try:
            server.quit()
            print(f"[Email] ✓ SMTP connection closed")
        except Exception as quit_error:
            print(f"[Email] ⚠ Warning: Error closing SMTP connection: {quit_error}")
        
        print(f"[Email] ✓ Verification email sent successfully to {to_email}")
        print(f"[Email] ===== Email Sending Complete =====")
        return True
        
    except smtplib.SMTPAuthenticationError as e:
        print(f"[Email] ✗ SMTP Authentication Error: {e}")
        print(f"[Email]   Check your SMTP_USERNAME and SMTP_PASSWORD in .env file")
        print(f"[Email]   For Gmail, make sure you're using an App Password, not your regular password")
        import traceback
        print(f"[Email] Traceback: {traceback.format_exc()}")
        return False
    except smtplib.SMTPConnectError as e:
        print(f"[Email] ✗ SMTP Connection Error: {e}")
        print(f"[Email]   Could not connect to {SMTP_HOST}:{SMTP_PORT}")
        print(f"[Email]   Check your network connection and SMTP settings")
        print(f"[Email]   Run 'python troubleshoot_email.py' for detailed diagnosis")
        import traceback
        print(f"[Email] Traceback: {traceback.format_exc()}")
        return False
    except smtplib.SMTPException as e:
        print(f"[Email] ✗ SMTP error while sending email to {to_email}: {e}")
        print(f"[Email]   Error type: {type(e).__name__}")
        print(f"[Email]   Run 'python troubleshoot_email.py' for detailed diagnosis")
        import traceback
        print(f"[Email] Traceback: {traceback.format_exc()}")
        return False
    except Exception as e:
        print(f"[Email] ✗ Unexpected error while sending email to {to_email}: {e}")
        print(f"[Email]   Error type: {type(e).__name__}")
        print(f"[Email]   Run 'python troubleshoot_email.py' for detailed diagnosis")
        import traceback
        print(f"[Email] Traceback: {traceback.format_exc()}")
        return False

