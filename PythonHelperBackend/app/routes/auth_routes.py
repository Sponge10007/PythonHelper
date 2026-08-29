import logging
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from app.database import get_db
from app.email_service import EmailService, get_verification_code_expiry, is_zju_email

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

VERIFICATION_RESEND_INTERVAL_SECONDS = 60


def _get_latest_pending_verification(email):
    db = get_db()
    return db.execute(
        '''
        SELECT verification_code, expires_at, created_at
        FROM pending_verifications
        WHERE email = ?
        ORDER BY created_at DESC
        LIMIT 1
        ''',
        (email,)
    ).fetchone()


def _store_pending_verification(email, verification_code):
    db = get_db()
    # 同一邮箱只保留最新一条验证码
    db.execute('DELETE FROM pending_verifications WHERE email = ?', (email,))
    db.execute(
        '''
        INSERT INTO pending_verifications
            (email, verification_code, expires_at, created_at)
        VALUES (?, ?, ?, ?)
        ''',
        (email, verification_code, get_verification_code_expiry(), datetime.now())
    )
    db.commit()


def _check_pending_verification(email, verification_code):
    record = _get_latest_pending_verification(email)
    if not record:
        return False, '验证码不存在，请先获取验证码'

    expires_at = datetime.fromisoformat(record['expires_at'])
    if datetime.now() > expires_at:
        return False, '验证码已过期，请重新获取'

    if record['verification_code'] != verification_code:
        return False, '验证码错误'

    return True, ''


def _clear_pending_verification(email):
    db = get_db()
    db.execute('DELETE FROM pending_verifications WHERE email = ?', (email,))
    db.commit()


def _can_send_verification(email):
    record = _get_latest_pending_verification(email)
    if not record:
        return True, ''

    created_at = datetime.fromisoformat(record['created_at'])
    elapsed = (datetime.now() - created_at).total_seconds()
    if elapsed < VERIFICATION_RESEND_INTERVAL_SECONDS:
        return False, f'发送太频繁，请 {int(VERIFICATION_RESEND_INTERVAL_SECONDS - elapsed) + 1} 秒后再试'

    return True, ''


@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册：校验 ZJU 邮箱 + 邮箱验证码。"""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', '')).strip()
        verification_code = str(data.get('verification_code', '')).strip()

        if not email or not password or not verification_code:
            return jsonify({'success': False, 'message': '邮箱、密码和验证码不能为空'}), 400

        if not is_zju_email(email):
            return jsonify({'success': False, 'message': '只允许使用@zju.edu.cn邮箱注册'}), 400

        if len(password) < 6:
            return jsonify({'success': False, 'message': '密码长度至少6位'}), 400

        db = get_db()
        if db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
            return jsonify({'success': False, 'message': '该邮箱已被注册'}), 400

        valid, message = _check_pending_verification(email, verification_code)
        if not valid:
            return jsonify({'success': False, 'message': message}), 400

        password_hash = generate_password_hash(password)
        db.execute(
            '''
            INSERT INTO users (email, password_hash, is_verified)
            VALUES (?, ?, TRUE)
            ''',
            (email, password_hash)
        )
        db.commit()
        _clear_pending_verification(email)

        return jsonify({'success': True, 'message': '注册成功，请登录', 'email': email})
    except Exception as e:
        logger.error(f"注册失败: {e}")
        return jsonify({'success': False, 'message': '注册失败，请稍后重试'}), 500


@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """兼容旧注册数据的邮箱验证接口。"""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()
        verification_code = str(data.get('verification_code', '')).strip()

        if not email or not verification_code:
            return jsonify({'success': False, 'message': '邮箱和验证码不能为空'}), 400

        db = get_db()
        user = db.execute(
            '''
            SELECT id, verification_code, verification_code_expires, is_verified
            FROM users WHERE email = ?
            ''',
            (email,)
        ).fetchone()

        if not user:
            return jsonify({'success': False, 'message': '用户不存在'}), 404

        if user['is_verified']:
            return jsonify({'success': False, 'message': '邮箱已经验证过了'}), 400

        if not user['verification_code_expires']:
            return jsonify({'success': False, 'message': '验证码不存在，请重新获取'}), 400

        if datetime.now() > datetime.fromisoformat(user['verification_code_expires']):
            return jsonify({'success': False, 'message': '验证码已过期，请重新获取'}), 400

        if user['verification_code'] != verification_code:
            return jsonify({'success': False, 'message': '验证码错误'}), 400

        db.execute(
            '''
            UPDATE users
            SET is_verified = TRUE,
                verification_code = NULL,
                verification_code_expires = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
            ''',
            (email,)
        )
        db.commit()

        return jsonify({'success': True, 'message': '邮箱验证成功！现在可以登录了'})
    except Exception as e:
        logger.error(f"邮箱验证失败: {e}")
        return jsonify({'success': False, 'message': '验证失败，请稍后重试'}), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录：必须使用已验证邮箱。"""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()
        password = str(data.get('password', '')).strip()

        if not email or not password:
            return jsonify({'success': False, 'message': '邮箱和密码不能为空'}), 400

        db = get_db()
        user = db.execute(
            'SELECT id, email, password_hash, is_verified FROM users WHERE email = ?',
            (email,)
        ).fetchone()

        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({'success': False, 'message': '邮箱或密码错误'}), 401

        if not user['is_verified']:
            return jsonify({'success': False, 'message': '邮箱尚未验证，请先完成验证'}), 403

        db.execute('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', (user['id'],))
        db.commit()

        # 登录成功后轮换会话，降低会话固定风险
        session.clear()
        session.permanent = True
        session['user_id'] = user['id']
        session['user_email'] = user['email']

        # 初始化默认PPT（失败不阻断登录）
        try:
            from app.database import init_mistakes_db
            database = init_mistakes_db()
            ppt_folder = current_app.config.get('PPT_UPLOAD_FOLDER')
            if ppt_folder:
                database.init_default_ppts_for_user(user['id'], ppt_folder)
        except Exception as e:
            logger.warning(f"初始化默认PPT失败（非致命错误）: {e}")

        return jsonify({
            'success': True,
            'message': '登录成功',
            'user': {'id': user['id'], 'email': user['email']}
        })
    except Exception as e:
        logger.error(f"登录失败: {e}")
        return jsonify({'success': False, 'message': '登录失败，请稍后重试'}), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """用户登出。"""
    session.clear()
    return jsonify({'success': True, 'message': '登出成功'})


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """忘记密码：发送重置验证码到 pending_verifications 表。"""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()

        if not email:
            return jsonify({'success': False, 'message': '邮箱不能为空'}), 400

        db = get_db()
        user = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()
        if not user:
            return jsonify({'success': False, 'message': '该邮箱未注册'}), 404

        can_send, message = _can_send_verification(email)
        if not can_send:
            return jsonify({'success': False, 'message': message}), 429

        email_service = EmailService()
        verification_code = email_service.generate_verification_code()
        if not email_service.send_password_reset_email(email, verification_code):
            return jsonify({'success': False, 'message': '重置邮件发送失败，请稍后重试'}), 500

        _store_pending_verification(email, verification_code)
        return jsonify({'success': True, 'message': '密码重置验证码已发送到您的邮箱'})
    except Exception as e:
        logger.error(f"忘记密码处理失败: {e}")
        return jsonify({'success': False, 'message': '处理失败，请稍后重试'}), 500


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """重置密码：从 pending_verifications 表验证验证码。"""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()
        verification_code = str(data.get('verification_code', '')).strip()
        new_password = str(data.get('new_password', '')).strip()

        if not email or not verification_code or not new_password:
            return jsonify({'success': False, 'message': '邮箱、验证码和新密码不能为空'}), 400

        if len(new_password) < 6:
            return jsonify({'success': False, 'message': '密码长度至少6位'}), 400

        db = get_db()
        if not db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone():
            return jsonify({'success': False, 'message': '用户不存在'}), 404

        valid, message = _check_pending_verification(email, verification_code)
        if not valid:
            return jsonify({'success': False, 'message': message}), 400

        db.execute(
            '''
            UPDATE users
            SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
            ''',
            (generate_password_hash(new_password), email)
        )
        db.commit()
        _clear_pending_verification(email)

        return jsonify({'success': True, 'message': '密码重置成功，请使用新密码登录'})
    except Exception as e:
        logger.error(f"密码重置失败: {e}")
        return jsonify({'success': False, 'message': '密码重置失败，请稍后重试'}), 500


@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    """重新发送验证码：写入 pending_verifications，供注册/重置校验。"""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()

        if not email:
            return jsonify({'success': False, 'message': '邮箱不能为空'}), 400

        if not is_zju_email(email):
            return jsonify({'success': False, 'message': '只允许使用@zju.edu.cn邮箱'}), 400

        can_send, message = _can_send_verification(email)
        if not can_send:
            return jsonify({'success': False, 'message': message}), 429

        email_service = EmailService()
        verification_code = email_service.generate_verification_code()
        if not email_service.send_verification_email(email, verification_code):
            return jsonify({'success': False, 'message': '验证邮件发送失败，请稍后重试'}), 500

        _store_pending_verification(email, verification_code)
        return jsonify({'success': True, 'message': '验证码已重新发送到您的邮箱'})
    except Exception as e:
        logger.error(f"重发验证码失败: {e}")
        return jsonify({'success': False, 'message': '发送失败，请稍后重试'}), 500


@auth_bp.route('/check-auth', methods=['GET'])
def check_auth():
    """检查登录状态。"""
    user_id = session.get('user_id')
    user_email = session.get('user_email')
    if user_id and user_email:
        return jsonify({
            'authenticated': True,
            'user': {'id': user_id, 'email': user_email}
        })
    return jsonify({'authenticated': False})


@auth_bp.route('/send-verification', methods=['POST'])
def send_verification():
    """发送验证码（注册/重置通用）。"""
    try:
        data = request.get_json(silent=True) or {}
        email = str(data.get('email', '')).strip().lower()
        verification_type = data.get('type', 'register')

        if not email:
            return jsonify({'success': False, 'message': '邮箱不能为空'}), 400

        if not is_zju_email(email):
            return jsonify({'success': False, 'message': '只允许使用@zju.edu.cn邮箱'}), 400

        db = get_db()
        existing_user = db.execute('SELECT id FROM users WHERE email = ?', (email,)).fetchone()

        if verification_type == 'register':
            if existing_user:
                return jsonify({'success': False, 'message': '该邮箱已被注册，请直接登录'}), 400
        elif verification_type == 'reset':
            if not existing_user:
                return jsonify({'success': False, 'message': '该邮箱未注册，请先注册账户'}), 400
        else:
            return jsonify({'success': False, 'message': '无效的验证类型'}), 400

        can_send, message = _can_send_verification(email)
        if not can_send:
            return jsonify({'success': False, 'message': message}), 429

        email_service = EmailService()
        verification_code = email_service.generate_verification_code()
        if not email_service.send_verification_email(email, verification_code):
            return jsonify({'success': False, 'message': '验证码发送失败，请稍后重试'}), 500

        _store_pending_verification(email, verification_code)
        logger.info(f"验证码已发送至: {email} (类型: {verification_type})")
        return jsonify({'success': True, 'message': '验证码已发送，请查收邮件'})
    except Exception as e:
        logger.error(f"发送验证码失败: {e}")
        return jsonify({'success': False, 'message': '验证码发送失败，请稍后重试'}), 500
