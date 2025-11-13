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
        
        if SMTP_PORT == 465:
            # SSL 사용
            server = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT)
        else:
            # TLS 사용
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            server.starttls()
        
        # 로그인
        server.login(SMTP_USERNAME, SMTP_PASSWORD)
        print(f"[Email] Logged in to SMTP server as {SMTP_USERNAME}")
        
        # 이메일 발송
        server.send_message(msg)
        server.quit()
        
        print(f"[Email] Verification email sent successfully to {to_email}")
        return True
        
    except smtplib.SMTPException as e:
        print(f"[Email] SMTP error while sending email to {to_email}: {e}")
        return False
    except Exception as e:
        print(f"[Email] Unexpected error while sending email to {to_email}: {e}")
        import traceback
        print(f"[Email] Traceback: {traceback.format_exc()}")
        return False

