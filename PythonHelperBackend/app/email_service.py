import smtplib
from email.mime.text import MIMEText
from email.utils import formataddr
from flask import current_app
import secrets, logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

class EmailService:
    def __init__(self):
        self.smtp_host = current_app.config['SMTP_HOST']
        self.smtp_port = current_app.config['SMTP_PORT']
        self.smtp_user = current_app.config['SMTP_USER']
        self.smtp_pass = current_app.config['SMTP_PASS']
        self.from_name = current_app.config['SMTP_FROM_NAME']

    def generate_verification_code(self):
        """生成 6 位数字验证码"""
        return ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    def send_email(self, to_email, subject, html_content):
        """SMTP 方式发送邮件"""
        try:
            msg = MIMEText(html_content, 'html', 'utf-8')
            msg['From'] = formataddr([self.from_name, self.smtp_user])
            msg['To'] = to_email
            msg['Subject'] = subject

            with smtplib.SMTP_SSL(self.smtp_host, self.smtp_port) as server:
                server.login(self.smtp_user, self.smtp_pass)
                server.sendmail(self.smtp_user, [to_email], msg.as_string())

            logger.info(f"邮件已发送到: {to_email}")
            return True
        except Exception as e:
            logger.error(f"发送邮件失败: {e}")
            return False

    def send_verification_email(self, to_email, verification_code):
        """发送注册验证码"""
        html_content = f"""
        <h3>Python Helper · 邮箱验证</h3>
        <p>您好！您的验证码是：</p>
        <h2 style="color:#2c3e50;">{verification_code}</h2>
        <p>有效期 10 分钟，请尽快使用。</p>
        """
        return self.send_email(to_email, "Python Helper - 邮箱验证码", html_content)

    def send_password_reset_email(self, to_email, verification_code):
        """发送重置密码验证码"""
        html_content = f"""
        <h3>Python Helper · 密码重置</h3>
        <p>您正在重置密码，验证码为：</p>
        <h2 style="color:#2c3e50;">{verification_code}</h2>
        <p>有效期 10 分钟，请尽快使用。</p>
        """
        return self.send_email(to_email, "Python Helper - 密码重置验证码", html_content)


def is_zju_email(email):
    return email.lower().endswith('@zju.edu.cn')

def get_verification_code_expiry():
    return datetime.now() + timedelta(minutes=10)
