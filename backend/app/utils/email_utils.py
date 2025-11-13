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
    # SMTP 설정 검증 (상세 로깅)
    print(f"[Email] ===== Email Sending Debug Info =====")
    print(f"[Email] SMTP_HOST: {SMTP_HOST}")
    print(f"[Email] SMTP_PORT: {SMTP_PORT}")
    print(f"[Email] SMTP_USERNAME: {SMTP_USERNAME if SMTP_USERNAME else '(empty)'}")
    print(f"[Email] SMTP_PASSWORD: {'SET (' + str(len(SMTP_PASSWORD)) + ' chars)' if SMTP_PASSWORD else '(empty)'}")
    print(f"[Email] SMTP_FROM_EMAIL: {SMTP_FROM_EMAIL if SMTP_FROM_EMAIL else '(empty)'}")
    print(f"[Email] SMTP_FROM_NAME: {SMTP_FROM_NAME}")
    print(f"[Email] =====================================")
    
    if not SMTP_USERNAME or not SMTP_PASSWORD:
        print(f"[Email] ✗ ERROR: SMTP credentials not configured!")
        print(f"[Email]   SMTP_USERNAME: {'SET' if SMTP_USERNAME else 'NOT SET'}")
        print(f"[Email]   SMTP_PASSWORD: {'SET' if SMTP_PASSWORD else 'NOT SET'}")
        print(f"[Email]   Please check your .env file in the backend directory")
        return False
    
    if not SMTP_HOST:
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
        msg['From'] = f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
        msg['To'] = to_email
        
        # 텍스트 및 HTML 본문 추가
        text_part = MIMEText(text_body, 'plain', 'utf-8')
        html_part = MIMEText(html_body, 'html', 'utf-8')
        msg.attach(text_part)
        msg.attach(html_part)
        
        # SMTP 서버 연결 및 이메일 발송
        print(f"[Email] Connecting to SMTP server: {SMTP_HOST}:{SMTP_PORT}")
        print(f"[Email] From: {SMTP_FROM_EMAIL} ({SMTP_FROM_NAME})")
        print(f"[Email] To: {to_email}")
        
        # 비밀번호의 공백 제거 (일부 서비스의 앱 비밀번호에 공백이 포함될 수 있음)
        smtp_password = SMTP_PASSWORD.replace(' ', '')
        
        server = None
        try:
            if SMTP_PORT == 465:
                # SSL 사용
                print(f"[Email] Using SSL connection (port 465)")
                server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30)
                print(f"[Email] ✓ SSL connection established")
            else:
                # TLS 사용
                print(f"[Email] Using TLS connection (port {SMTP_PORT})")
                server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30)
                print(f"[Email] ✓ SMTP connection established")
                server.starttls()
                print(f"[Email] ✓ TLS handshake completed")
        except smtplib.SMTPConnectError as conn_error:
            print(f"[Email] ✗ SMTP Connection Error!")
            print(f"[Email]   Could not connect to {SMTP_HOST}:{SMTP_PORT}")
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
        print(f"[Email] Attempting to login as {SMTP_USERNAME}")
        print(f"[Email] Password length: {len(smtp_password)} characters")
        try:
            server.login(SMTP_USERNAME, smtp_password)
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

