import hashlib
import sqlite3
import logging
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify, current_app, session
from werkzeug.security import generate_password_hash, check_password_hash
from app.database import get_db
from app.email_service import EmailService, is_zju_email, get_verification_code_expiry

logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


@auth_bp.route('/register', methods=['POST'])
def register():
    """用户注册 - 需要zju.edu.cn邮箱"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        # 验证输入
        if not email or not password:
            return jsonify({
                'success': False,
                'message': '邮箱和密码不能为空'
            }), 400
            
        # 验证浙大邮箱
        if not is_zju_email(email):
            return jsonify({
                'success': False,
                'message': '只允许使用@zju.edu.cn邮箱注册'
            }), 400
            
        # 密码强度验证
        if len(password) < 6:
            return jsonify({
                'success': False,
                'message': '密码长度至少6位'
            }), 400
            
        # 检查邮箱是否已存在
        db = get_db()
        existing_user = db.execute(
            'SELECT id FROM users WHERE email = ?', (email,)
        ).fetchone()
        
        if existing_user:
            return jsonify({
                'success': False,
                'message': '该邮箱已被注册'
            }), 400
            
        # 生成验证码
        email_service = EmailService()
        verification_code = email_service.generate_verification_code()
        
        # 发送验证邮件
        if not email_service.send_verification_email(email, verification_code):
            return jsonify({
                'success': False,
                'message': '验证邮件发送失败，请稍后重试'
            }), 500
            
        # 保存用户信息（直接激活状态）
        password_hash = generate_password_hash(password)
        verification_expires = get_verification_code_expiry()
        
        db.execute('''
            INSERT INTO users 
            (email, password_hash, verification_code, verification_code_expires, is_verified)
            VALUES (?, ?, ?, ?, TRUE)
        ''', (email, password_hash, verification_code, verification_expires))
        db.commit()
        
        return jsonify({
            'success': True,
            'message': '注册成功！验证码已发送到您的邮箱，验证后即可登录',
            'email': email
        })
        
    except Exception as e:
        logger.error(f"注册失败: {e}")
        return jsonify({
            'success': False,
            'message': '注册失败，请稍后重试'
        }), 500


@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """验证邮箱"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        verification_code = data.get('verification_code', '').strip()
        
        if not email or not verification_code:
            return jsonify({
                'success': False,
                'message': '邮箱和验证码不能为空'
            }), 400
            
        db = get_db()
        user = db.execute('''
            SELECT id, verification_code, verification_code_expires, is_verified
            FROM users WHERE email = ?
        ''', (email,)).fetchone()
        
        if not user:
            return jsonify({
                'success': False,
                'message': '用户不存在'
            }), 404
            
        if user['is_verified']:
            return jsonify({
                'success': False,
                'message': '邮箱已经验证过了'
            }), 400
            
        # 验证码过期检查
        if datetime.now() > datetime.fromisoformat(user['verification_code_expires']):
            return jsonify({
                'success': False,
                'message': '验证码已过期，请重新获取'
            }), 400
            
        # 验证码匹配检查
        if user['verification_code'] != verification_code:
            return jsonify({
                'success': False,
                'message': '验证码错误'
            }), 400
            
        # 激活用户
        db.execute('''
            UPDATE users 
            SET is_verified = TRUE, verification_code = NULL, verification_code_expires = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (email,))
        db.commit()
        
        return jsonify({
            'success': True,
            'message': '邮箱验证成功！现在可以登录了'
        })
        
    except Exception as e:
        logger.error(f"邮箱验证失败: {e}")
        return jsonify({
            'success': False,
            'message': '验证失败，请稍后重试'
        }), 500


@auth_bp.route('/login', methods=['POST'])
def login():
    """用户登录"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        if not email or not password:
            return jsonify({
                'success': False,
                'message': '邮箱和密码不能为空'
            }), 400
            
        db = get_db()
        user = db.execute('''
            SELECT id, email, password_hash
            FROM users WHERE email = ?
        ''', (email,)).fetchone()
        
        if not user or not check_password_hash(user['password_hash'], password):
            return jsonify({
                'success': False,
                'message': '邮箱或密码错误'
            }), 401
            
        # 更新最后登录时间
        db.execute('''
            UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?
        ''', (user['id'],))
        db.commit()

        # 创建会话
        session['user_id'] = user['id']
        session['user_email'] = user['email']

        # 初始化默认PPT（首次登录时）
        try:
            from app.database import init_mistakes_db
            database = init_mistakes_db()
            ppt_folder = current_app.config.get('PPT_UPLOAD_FOLDER')
            if ppt_folder:
                database.init_default_ppts_for_user(user['id'], ppt_folder)
                logger.info(f"为用户 {user['id']} 初始化默认PPT")
        except Exception as e:
            logger.warning(f"初始化默认PPT失败（非致命错误）: {e}")

        return jsonify({
            'success': True,
            'message': '登录成功',
            'user': {
                'id': user['id'],
                'email': user['email']
            }
        })
        
    except Exception as e:
        logger.error(f"登录失败: {e}")
        return jsonify({
            'success': False,
            'message': '登录失败，请稍后重试'
        }), 500


@auth_bp.route('/logout', methods=['POST'])
def logout():
    """用户登出"""
    session.clear()
    return jsonify({
        'success': True,
        'message': '登出成功'
    })


@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """忘记密码 - 发送重置验证码"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({
                'success': False,
                'message': '邮箱不能为空'
            }), 400
            
        db = get_db()
        user = db.execute('''
            SELECT id FROM users WHERE email = ?
        ''', (email,)).fetchone()
        
        if not user:
            return jsonify({
                'success': False,
                'message': '该邮箱未注册'
            }), 404
            
        # 生成重置验证码
        email_service = EmailService()
        verification_code = email_service.generate_verification_code()
        
        # 发送重置邮件
        if not email_service.send_password_reset_email(email, verification_code):
            return jsonify({
                'success': False,
                'message': '重置邮件发送失败，请稍后重试'
            }), 500
            
        # 保存重置验证码
        verification_expires = get_verification_code_expiry()
        db.execute('''
            UPDATE users 
            SET verification_code = ?, verification_code_expires = ?
            WHERE email = ?
        ''', (verification_code, verification_expires, email))
        db.commit()
        
        return jsonify({
            'success': True,
            'message': '密码重置验证码已发送到您的邮箱'
        })
        
    except Exception as e:
        logger.error(f"忘记密码处理失败: {e}")
        return jsonify({
            'success': False,
            'message': '处理失败，请稍后重试'
        }), 500


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """重置密码"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        verification_code = data.get('verification_code', '').strip()
        new_password = data.get('new_password', '').strip()
        
        if not email or not verification_code or not new_password:
            return jsonify({
                'success': False,
                'message': '邮箱、验证码和新密码不能为空'
            }), 400
            
        # 密码强度验证
        if len(new_password) < 6:
            return jsonify({
                'success': False,
                'message': '密码长度至少6位'
            }), 400
            
        db = get_db()
        
        # 首先检查用户是否存在
        user = db.execute('''
            SELECT id FROM users WHERE email = ?
        ''', (email,)).fetchone()
        
        if not user:
            return jsonify({
                'success': False,
                'message': '用户不存在'
            }), 404
        
        # 从pending_verifications表中验证验证码
        verification_record = db.execute('''
            SELECT verification_code, expires_at
            FROM pending_verifications WHERE email = ?
            ORDER BY created_at DESC LIMIT 1
        ''', (email,)).fetchone()
        
        if not verification_record:
            return jsonify({
                'success': False,
                'message': '验证码不存在，请重新获取'
            }), 400
            
        # 验证码过期检查
        expires_at = datetime.fromisoformat(verification_record['expires_at'])
        if datetime.now() > expires_at:
            return jsonify({
                'success': False,
                'message': '验证码已过期，请重新获取'
            }), 400
            
        # 验证码匹配检查
        if verification_record['verification_code'] != verification_code:
            return jsonify({
                'success': False,
                'message': '验证码错误'
            }), 400
            
        # 更新密码
        new_password_hash = generate_password_hash(new_password)
        db.execute('''
            UPDATE users
            SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
            WHERE email = ?
        ''', (new_password_hash, email))
        
        # 清理验证码记录
        db.execute('''
            DELETE FROM pending_verifications WHERE email = ?
        ''', (email,))
        
        db.commit()
        
        return jsonify({
            'success': True,
            'message': '密码重置成功，请使用新密码登录'
        })
        
    except Exception as e:
        logger.error(f"密码重置失败: {e}")
        return jsonify({
            'success': False,
            'message': '密码重置失败，请稍后重试'
        }), 500


@auth_bp.route('/resend-verification', methods=['POST'])
def resend_verification():
    """重新发送验证码"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        
        if not email:
            return jsonify({
                'success': False,
                'message': '邮箱不能为空'
            }), 400
            
        db = get_db()
        user = db.execute('''
            SELECT id FROM users WHERE email = ?
        ''', (email,)).fetchone()
        
        if not user:
            return jsonify({
                'success': False,
                'message': '用户不存在'
            }), 404
            
        # 生成新验证码
        email_service = EmailService()
        verification_code = email_service.generate_verification_code()
        
        # 发送验证邮件
        if not email_service.send_verification_email(email, verification_code):
            return jsonify({
                'success': False,
                'message': '验证邮件发送失败，请稍后重试'
            }), 500
            
        # 更新验证码
        verification_expires = get_verification_code_expiry()
        db.execute('''
            UPDATE users
            SET verification_code = ?, verification_code_expires = ?
            WHERE email = ?
        ''', (verification_code, verification_expires, email))
        db.commit()
        
        return jsonify({
            'success': True,
            'message': '验证码已重新发送到您的邮箱'
        })
        
    except Exception as e:
        logger.error(f"重发验证码失败: {e}")
        return jsonify({
            'success': False,
            'message': '发送失败，请稍后重试'
        }), 500


@auth_bp.route('/check-auth', methods=['GET'])
def check_auth():
    """检查登录状态"""
    user_id = session.get('user_id')
    user_email = session.get('user_email')
    
    if user_id and user_email:
        return jsonify({
            'authenticated': True,
            'user': {
                'id': user_id,
                'email': user_email
            }
        })
    else:
        return jsonify({
            'authenticated': False
        })


@auth_bp.route('/send-verification', methods=['POST'])
def send_verification():
    """发送验证码到指定邮箱（用于注册前验证或重置密码）"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        verification_type = data.get('type', 'register')  # 默认为注册类型
        
        if not email:
            print('邮箱不能为空')
            return jsonify({
                'success': False,
                'message': '邮箱不能为空'
            }), 400
            
        # 验证浙大邮箱
        if not is_zju_email(email):
            print('只允许使用@zju.edu.cn邮箱')
            return jsonify({
                'success': False,
                'message': '只允许使用@zju.edu.cn邮箱'
            }), 400
            
        # 检查邮箱是否已被注册
        db = get_db()
        existing_user = db.execute(
            'SELECT id FROM users WHERE email = ?', (email,)
        ).fetchone()
        
        # 根据验证类型进行不同的检查
        if verification_type == 'register':
            # 注册验证：邮箱不应该已被注册
            if existing_user:
                print('该邮箱已被注册，请直接登录')
                return jsonify({
                    'success': False,
                    'message': '该邮箱已被注册，请直接登录'
                }), 400
        elif verification_type == 'reset':
            # 重置密码验证：邮箱必须已被注册
            if not existing_user:
                print('该邮箱未注册，请先注册账户')
                return jsonify({
                    'success': False,
                    'message': '该邮箱未注册，请先注册账户'
                }), 400
        else:
            print('无效的验证类型')
            return jsonify({
                'success': False,
                'message': '无效的验证类型'
            }), 400
            
        # 生成验证码
        email_service = EmailService()
        verification_code = email_service.generate_verification_code()
        
        # 发送验证邮件
        if not email_service.send_verification_email(email, verification_code):
            print('验证码发送失败，请稍后重试')
            return jsonify({
                'success': False,
                'message': '验证码发送失败，请稍后重试'
            }), 500
            
        # 临时存储验证码（用于后续验证）
        expiry = get_verification_code_expiry()
        db.execute('''
            INSERT OR REPLACE INTO pending_verifications
            (email, verification_code, expires_at, created_at)
            VALUES (?, ?, ?, ?)
        ''', (email, verification_code, expiry, datetime.now()))
        db.commit()

        logger.info(f"验证码已发送至: {email} (类型: {verification_type})")
        return jsonify({
            'success': True,
            'message': '验证码已发送，请查收邮件'
        })

    except Exception as e:
        logger.error(f"发送验证码失败: 500 {str(e)}")
        return jsonify({
            'success': False,
            'message': '验证码发送失败，请稍后重试'
        }), 500
