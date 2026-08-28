from flask import Blueprint, jsonify, request, send_file, current_app, make_response, session
from app.database import get_db
from app.utils import allowed_file, estimate_slides_count, get_file_info, login_required, validate_uploaded_file_content
import html
import logging
import json
import os
import uuid
import mimetypes
from datetime import datetime

ppt_bp = Blueprint('ppt', __name__)
logger = logging.getLogger(__name__)


def _get_owned_ppt_or_error(ppt_id):
    """获取当前用户拥有的PPT记录；无权限时返回错误响应。"""
    user_id = session.get('user_id')
    if not user_id:
        return None, jsonify({'error': '未登录'}), 401

    row = get_db().execute(
        'SELECT * FROM ppt_files WHERE id = ? AND user_id = ?',
        (ppt_id, user_id)
    ).fetchone()
    if not row:
        return None, jsonify({'error': 'PPT文件不存在或无权访问'}), 404

    return row, None, None


def _remove_ppt_physical_file(db, row):
    """删除物理文件；默认课件被多个用户共享时只删记录，不删共享文件。"""
    file_path = row['file_path']
    if not file_path or not os.path.exists(file_path):
        return

    if row['is_default']:
        ref_count = db.execute(
            'SELECT COUNT(*) FROM ppt_files WHERE file_path = ? AND id != ?',
            (file_path, row['id'])
        ).fetchone()[0]
        if ref_count > 0:
            logger.info(f"共享默认PPT仍有 {ref_count} 个用户使用，保留物理文件: {file_path}")
            return

    os.remove(file_path)
    logger.info(f"删除物理文件: {file_path}")


def _parse_ppt_tags(raw_tags):
    """安全解析 PPT 标签 JSON，兼容历史错误数据。"""
    if not raw_tags:
        return []
    try:
        tags = json.loads(raw_tags)
        if isinstance(tags, list):
            return [str(tag) for tag in tags]
        return [str(tags)]
    except (TypeError, json.JSONDecodeError):
        return [str(raw_tags)]


@ppt_bp.route('/upload', methods=['POST'])
@login_required
def upload_ppt():
    """上传PPT文件（记录用户ID）"""
    try:
        user_id = session.get('user_id')

        if 'file' not in request.files:
            return jsonify({'error': '没有文件'}), 400
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'error': '没有选择文件或文件类型不支持'}), 400

        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{ext}"
        file_path = os.path.join(current_app.config['PPT_UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)

        if not os.path.exists(file_path):
            raise Exception(f"文件保存失败: {file_path}")

        if not validate_uploaded_file_content(file_path, ext):
            os.remove(file_path)
            return jsonify({'error': '文件内容与扩展名不匹配'}), 400

        info = get_file_info(file_path)
        slides = estimate_slides_count(file_path, ext)

        # 解析 tags：前端发送 JSON 字符串，这里只做一次编码保存
        raw_tags = request.form.get('tags', '[]')
        try:
            tags_list = json.loads(raw_tags)
            if not isinstance(tags_list, list):
                tags_list = [str(tags_list)]
        except (TypeError, json.JSONDecodeError):
            tags_list = [raw_tags] if raw_tags else []

        db = get_db()
        cursor = db.execute('''
            INSERT INTO ppt_files (filename, original_name, file_path, file_size, file_type,
                                   upload_date, slides_count, description, tags, user_id, is_default)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
        ''', (
            unique_filename, file.filename, file_path, info['size'], ext,
            datetime.now().isoformat(),
            slides, request.form.get('description', ''),
            json.dumps(tags_list, ensure_ascii=False),
            user_id  # 记录用户ID
        ))
        ppt_id = cursor.lastrowid
        db.commit()

        logger.info(f"用户 {user_id} 成功上传PPT文件: {file.filename}")
        return jsonify({
            'status': 'success', 'message': '文件上传成功', 'ppt_id': ppt_id,
            'filename': unique_filename, 'original_name': file.filename,
            'file_size': info['size'], 'slides_count': slides
        })
    except Exception as e:
        logger.error(f"上传PPT文件失败: {e}")
        return jsonify({'error': str(e)}), 500


@ppt_bp.route('/files', methods=['GET'])
@login_required
def get_ppt_files():
    """获取当前用户的PPT文件列表（包括默认PPT）"""
    try:
        user_id = session.get('user_id')

        # 查询该用户的所有PPT（包括默认的和上传的）
        rows = get_db().execute('''
            SELECT * FROM ppt_files
            WHERE user_id = ?
            ORDER BY is_default DESC, upload_date DESC
        ''', (user_id,)).fetchall()

        ppt_files = [{
            'id': r['id'],
            'filename': r['filename'],
            'original_name': r['original_name'],
            'file_size': r['file_size'],
            'file_type': r['file_type'],
            'upload_date': r['upload_date'],
            'slides_count': r['slides_count'],
            'description': r['description'] or '',
            'tags': _parse_ppt_tags(r['tags']),
            'is_default': bool(r['is_default'])
        } for r in rows]

        logger.info(f"用户 {user_id} 获取PPT列表，共 {len(ppt_files)} 个文件")
        return jsonify({'ppt_files': ppt_files})
    except Exception as e:
        logger.error(f"获取PPT文件失败: {e}")
        return jsonify({'error': str(e)}), 500


@ppt_bp.route('/files/<int:ppt_id>/info', methods=['GET'])
@login_required
def get_ppt_info(ppt_id):
    """获取单个PPT文件信息。"""
    try:
        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status
        return jsonify({
            'id': row['id'],
            'filename': row['filename'],
            'original_name': row['original_name'],
            'file_size': row['file_size'],
            'file_type': row['file_type'],
            'upload_date': row['upload_date'],
            'slides_count': row['slides_count'],
            'description': row['description'] or '',
            'tags': _parse_ppt_tags(row['tags']),
            'is_default': bool(row['is_default'])
        })
    except Exception as e:
        logger.error(f"获取PPT信息失败: {e}")
        return jsonify({'error': f'获取PPT信息失败: {str(e)}'}), 500


@ppt_bp.route('/files/<int:ppt_id>/download', methods=['GET'])
@login_required
def download_ppt(ppt_id):
    try:
        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status

        file_path = row['file_path']
        if not os.path.exists(file_path):
            return jsonify({'error': f'文件不存在: {row["filename"]}'}), 404

        return send_file(
            file_path, as_attachment=True, download_name=row['original_name'],
            mimetype=mimetypes.guess_type(file_path)[0]
        )
    except Exception as e:
        logger.error(f"下载PPT文件失败: {e}")
        return jsonify({'error': f'下载失败: {str(e)}'}), 500


@ppt_bp.route('/files/<int:ppt_id>/preview', methods=['GET'])
@login_required
def preview_ppt(ppt_id):
    """PPT文件预览"""
    try:
        preview_type = request.args.get('type', 'auto')

        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status

        file_path = row['file_path']
        if not os.path.exists(file_path):
            return jsonify({'error': f'文件不存在: {row["filename"]}'}), 404

        file_type = row['file_type'].lower()

        # 根据预览类型返回不同内容
        if preview_type == 'direct':
            # 直接返回文件用于浏览器预览
            return send_file(file_path, mimetype=mimetypes.guess_type(file_path)[0])
        elif preview_type == 'pdf' or file_type == 'pdf':
            # PDF文件直接返回
            return send_file(file_path, mimetype='application/pdf')
        else:
            # 其他类型返回预览URL
            preview_url = f"/ppt/files/{ppt_id}/preview?type=direct"
            return jsonify({
                'preview_url': preview_url,
                'file_type': file_type,
                'original_name': row['original_name']
            })

    except Exception as e:
        logger.error(f"预览PPT文件失败: {e}")
        return jsonify({'error': f'预览失败: {str(e)}'}), 500


@ppt_bp.route('/files/<int:ppt_id>/thumbnail', methods=['GET'])
@login_required
def get_ppt_thumbnail(ppt_id):
    """获取PPT文件缩略图"""
    try:
        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status

        file_path = row['file_path']
        if not os.path.exists(file_path):
            return jsonify({'error': f'文件不存在: {row["filename"]}'}), 404

        # 生成缩略图（这里使用简单的默认图标，实际项目中可以使用专门的库）
        file_type = row['file_type'].lower()

        # 创建SVG缩略图
        svg_content = generate_thumbnail_svg(file_type, row['original_name'])

        response = make_response(svg_content)
        response.headers['Content-Type'] = 'image/svg+xml'
        response.headers['Cache-Control'] = 'public, max-age=3600'
        return response

    except Exception as e:
        logger.error(f"获取缩略图失败: {e}")
        return jsonify({'error': f'获取缩略图失败: {str(e)}'}), 500


@ppt_bp.route('/files/<int:ppt_id>/slides', methods=['GET'])
@login_required
def get_ppt_slides(ppt_id):
    """获取PPT幻灯片列表"""
    try:
        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status

        # 模拟幻灯片数据（实际项目中需要使用python-pptx等库解析）
        slides_count = row['slides_count'] or 1
        slides = []

        for i in range(slides_count):
            slides.append({
                'slide_number': i + 1,
                'thumbnail_url': f"/ppt/files/{ppt_id}/slide/{i + 1}/thumbnail",
                'image_url': f"/ppt/files/{ppt_id}/slide/{i + 1}/image",
                'title': f"幻灯片 {i + 1}"
            })

        return jsonify({'slides': slides})

    except Exception as e:
        logger.error(f"获取幻灯片失败: {e}")
        return jsonify({'error': f'获取幻灯片失败: {str(e)}'}), 500


@ppt_bp.route('/files/<int:ppt_id>', methods=['DELETE'])
@login_required
def delete_ppt(ppt_id):
    """删除PPT文件"""
    try:
        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status

        # 删除数据库记录前先判断物理文件是否被共享
        db = get_db()
        _remove_ppt_physical_file(db, row)
        db.execute('DELETE FROM ppt_files WHERE id = ?', (ppt_id,))
        db.commit()

        logger.info(f"成功删除PPT文件: {row['original_name']}")
        return jsonify({
            'status': 'success',
            'message': '文件删除成功',
            'deleted_file': row['original_name']
        })

    except Exception as e:
        logger.error(f"删除PPT文件失败: {e}")
        return jsonify({'error': f'删除失败: {str(e)}'}), 500


@ppt_bp.route('/files/batch-delete', methods=['DELETE'])
@login_required
def batch_delete_ppts():
    """批量删除PPT文件（验证用户权限）"""
    try:
        user_id = session.get('user_id')

        data = request.get_json(silent=True) or {}
        if not data or 'ids' not in data:
            return jsonify({'error': '请提供要删除的文件ID列表'}), 400

        ids = data['ids']
        if not ids or not isinstance(ids, list):
            return jsonify({'error': 'ID列表格式错误'}), 400

        success_count = 0
        error_files = []
        db = get_db()

        for ppt_id in ids:
            try:
                row = db.execute(
                    'SELECT * FROM ppt_files WHERE id = ?',
                    (ppt_id,)
                ).fetchone()
                if row:
                    # 验证权限：只能删除自己的文件
                    if row['user_id'] != user_id:
                        error_files.append(f"无权删除文件ID {ppt_id}")
                        continue

                    # 删除物理文件（共享默认文件会保留）
                    _remove_ppt_physical_file(db, row)

                    # 删除数据库记录
                    db.execute('DELETE FROM ppt_files WHERE id = ?', (ppt_id,))
                    success_count += 1
                    logger.info(f"用户 {user_id} 批量删除: {row['original_name']}")
                else:
                    error_files.append(f"文件ID {ppt_id} 不存在")
            except Exception as e:
                error_files.append(f"删除文件ID {ppt_id} 失败: {str(e)}")
                logger.error(f"批量删除文件ID {ppt_id} 失败: {e}")

        db.commit()

        return jsonify({
            'status': 'success',
            'message': f'批量删除完成',
            'success_count': success_count,
            'total_count': len(ids),
            'errors': error_files
        })

    except Exception as e:
        logger.error(f"批量删除PPT文件失败: {e}")
        return jsonify({'error': f'批量删除失败: {str(e)}'}), 500


@ppt_bp.route('/search', methods=['GET'])
@login_required
def search_ppt_files():
    """搜索当前用户的PPT文件。"""
    try:
        user_id = session.get('user_id')
        query = request.args.get('q', '').strip()
        file_type = request.args.get('file_type', '').strip().lower()

        rows = get_db().execute(
            'SELECT * FROM ppt_files WHERE user_id = ?',
            (user_id,)
        ).fetchall()

        results = []
        for row in rows:
            original_name = row['original_name'] or ''
            description = row['description'] or ''
            tags = _parse_ppt_tags(row['tags'])

            if query and query.lower() not in original_name.lower() \
                    and query.lower() not in description.lower() \
                    and not any(query.lower() in str(tag).lower() for tag in tags):
                continue
            if file_type and file_type != (row['file_type'] or '').lower():
                continue

            results.append({
                'id': row['id'],
                'filename': row['filename'],
                'original_name': original_name,
                'file_size': row['file_size'],
                'file_type': row['file_type'],
                'upload_date': row['upload_date'],
                'slides_count': row['slides_count'],
                'description': description,
                'tags': tags,
                'is_default': bool(row['is_default'])
            })

        return jsonify({'results': results, 'count': len(results)})
    except Exception as e:
        logger.error(f"搜索PPT文件失败: {e}")
        return jsonify({'error': f'搜索失败: {str(e)}'}), 500


@ppt_bp.route('/stats', methods=['GET'])
@login_required
def get_ppt_stats():
    """获取当前用户的PPT统计信息"""
    try:
        db = get_db()
        user_id = session.get('user_id')

        # 基本统计
        stats = db.execute('''
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                SUM(slides_count) as total_slides,
                AVG(file_size) as avg_size
            FROM ppt_files
            WHERE user_id = ?
        ''', (user_id,)).fetchone()

        # 按类型统计
        type_stats = db.execute('''
            SELECT file_type, COUNT(*) as count 
            FROM ppt_files 
            WHERE user_id = ?
            GROUP BY file_type 
            ORDER BY count DESC
        ''', (user_id,)).fetchall()

        # 按日期统计（最近7天）
        recent_uploads = db.execute('''
            SELECT DATE(upload_date) as date, COUNT(*) as count
            FROM ppt_files 
            WHERE user_id = ? AND upload_date >= datetime('now', '-7 days')
            GROUP BY DATE(upload_date)
            ORDER BY date DESC
        ''', (user_id,)).fetchall()

        return jsonify({
            'total_files': stats['total_files'] or 0,
            'total_size': stats['total_size'] or 0,
            'total_slides': stats['total_slides'] or 0,
            'avg_size': stats['avg_size'] or 0,
            'type_distribution': [dict(row) for row in type_stats],
            'recent_uploads': [dict(row) for row in recent_uploads]
        })

    except Exception as e:
        logger.error(f"获取PPT统计信息失败: {e}")
        return jsonify({'error': f'获取统计信息失败: {str(e)}'}), 500


def generate_thumbnail_svg(file_type, filename):
    """生成SVG缩略图"""
    icon_map = {
        'pdf': '📄',
        'ppt': '📊',
        'pptx': '📊',
        'doc': '📝',
        'docx': '📝'
    }
    
    icon = icon_map.get(file_type.lower(), '📁')
    color_map = {
        'pdf': '#ff4444',
        'ppt': '#ff8800',
        'pptx': '#ff8800',
        'doc': '#4285f4',
        'docx': '#4285f4'
    }
    
    bg_color = color_map.get(file_type.lower(), '#6c757d')
    
    # 转义并截断文件名，避免文件名注入 SVG/HTML
    safe_filename = html.escape(filename or '')
    display_name = safe_filename[:20] + '...' if len(safe_filename) > 20 else safe_filename
    
    svg = f'''<svg width="200" height="150" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:{bg_color};stop-opacity:0.1" />
                <stop offset="100%" style="stop-color:{bg_color};stop-opacity:0.3" />
            </linearGradient>
        </defs>
        <rect width="200" height="150" fill="url(#bg)" stroke="{bg_color}" stroke-width="2" rx="8"/>
        <text x="100" y="70" font-family="Arial" font-size="48" text-anchor="middle" fill="{bg_color}">{icon}</text>
        <text x="100" y="130" font-family="Arial" font-size="12" text-anchor="middle" fill="#666" font-weight="500">{display_name}</text>
    </svg>'''
    
    return svg


@ppt_bp.route('/files/<int:ppt_id>/slide/<int:slide_num>/image', methods=['GET'])
@login_required
def get_slide_image(ppt_id, slide_num):
    """获取幻灯片图片"""
    try:
        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status

        file_info = dict(row)
        file_path = file_info['file_path']

        if not os.path.exists(file_path):
            return jsonify({'error': '文件不存在'}), 404

        original_name = html.escape(file_info['original_name'] or '')
        file_type = file_info['file_type'].lower()

        # 对于PDF文件，返回页面图片
        if file_type == 'pdf':
            # 这里应该实现PDF页面转图片的逻辑
            # 现在先返回一个占位符SVG
            svg_content = f'''<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1"/>
                <text x="400" y="280" font-family="Arial" font-size="24" text-anchor="middle" fill="#6c757d">
                    PDF 第 {slide_num} 页
                </text>
                <text x="400" y="320" font-family="Arial" font-size="16" text-anchor="middle" fill="#6c757d">
                    {original_name}
                </text>
            </svg>'''

            response = make_response(svg_content)
            response.headers['Content-Type'] = 'image/svg+xml'
            return response

        # 对于PPT文件，返回幻灯片图片
        elif file_type in ['ppt', 'pptx']:
            # 这里应该实现PPT转图片的逻辑
            # 现在先返回一个占位符SVG
            svg_content = f'''<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
                <rect width="800" height="600" fill="#fff2cc" stroke="#d6b656" stroke-width="1"/>
                <text x="400" y="280" font-family="Arial" font-size="24" text-anchor="middle" fill="#bf9000">
                    PPT 幻灯片 {slide_num}
                </text>
                <text x="400" y="320" font-family="Arial" font-size="16" text-anchor="middle" fill="#bf9000">
                    {original_name}
                </text>
            </svg>'''

            response = make_response(svg_content)
            response.headers['Content-Type'] = 'image/svg+xml'
            return response

        else:
            return jsonify({'error': '不支持的文件类型'}), 400

    except Exception as e:
        logger.error(f"获取幻灯片图片失败: {e}")
        return jsonify({'error': f'获取幻灯片图片失败: {str(e)}'}), 500


@ppt_bp.route('/files/<int:ppt_id>/slide/<int:slide_num>/thumbnail', methods=['GET'])
@login_required
def get_slide_thumbnail(ppt_id, slide_num):
    """获取幻灯片缩略图"""
    try:
        row, error, status = _get_owned_ppt_or_error(ppt_id)
        if error:
            return error, status

        file_info = dict(row)

        # 生成缩略图SVG
        svg_content = f'''<svg width="150" height="112" xmlns="http://www.w3.org/2000/svg">
            <rect width="150" height="112" fill="#f8f9fa" stroke="#dee2e6" stroke-width="1" rx="4"/>
            <text x="75" y="50" font-family="Arial" font-size="14" text-anchor="middle" fill="#6c757d">
                第 {slide_num} 页
            </text>
            <text x="75" y="75" font-family="Arial" font-size="10" text-anchor="middle" fill="#6c757d">
                {html.escape(file_info['file_type'] or '').upper()}
            </text>
        </svg>'''

        response = make_response(svg_content)
        response.headers['Content-Type'] = 'image/svg+xml'
        return response

    except Exception as e:
        logger.error(f"获取幻灯片缩略图失败: {e}")
        return jsonify({'error': f'获取幻灯片缩略图失败: {str(e)}'}), 500