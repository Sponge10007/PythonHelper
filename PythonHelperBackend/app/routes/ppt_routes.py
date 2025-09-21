from flask import Blueprint, jsonify, request, send_file, current_app, make_response
from app.database import get_db
from app.utils import allowed_file, get_file_info, estimate_slides_count
import logging
import json
import os
import uuid
import mimetypes
from datetime import datetime

ppt_bp = Blueprint('ppt', __name__)
logger = logging.getLogger(__name__)


@ppt_bp.route('/upload', methods=['POST'])
def upload_ppt():
    # ... (此路由内容与原代码相同)
    try:
        if 'file' not in request.files: return jsonify({'error': '没有文件'}), 400
        file = request.files['file']
        if file.filename == '' or not allowed_file(file.filename):
            return jsonify({'error': '没有选择文件或文件类型不支持'}), 400

        ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{ext}"
        file_path = os.path.join(current_app.config['PPT_UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)

        if not os.path.exists(file_path): raise Exception(f"文件保存失败: {file_path}")

        info = get_file_info(file_path)
        slides = estimate_slides_count(file_path, ext)

        db = get_db()
        cursor = db.execute('''
                            INSERT INTO ppt_files (filename, original_name, file_path, file_size, file_type,
                                                   upload_date, slides_count, description, tags)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            ''', (
                                unique_filename, file.filename, file_path, info['size'], ext,
                                datetime.now().isoformat(),
                                slides, request.form.get('description', ''),
                                json.dumps(request.form.get('tags', []), ensure_ascii=False)
                            ))
        ppt_id = cursor.lastrowid
        db.commit()

        logger.info(f"成功上传PPT文件: {file.filename}")
        return jsonify({
            'status': 'success', 'message': '文件上传成功', 'ppt_id': ppt_id,
            'filename': unique_filename, 'original_name': file.filename,
            'file_size': info['size'], 'slides_count': slides
        })
    except Exception as e:
        logger.error(f"上传PPT文件失败: {e}")
        return jsonify({'error': str(e)}), 500


@ppt_bp.route('/files', methods=['GET'])
def get_ppt_files():
    # ... (此路由内容与原代码相同)
    try:
        rows = get_db().execute('SELECT * FROM ppt_files ORDER BY upload_date DESC').fetchall()
        ppt_files = [{
            'id': r['id'], 'filename': r['filename'], 'original_name': r['original_name'],
            'file_path': r['file_path'], 'file_size': r['file_size'], 'file_type': r['file_type'],
            'upload_date': r['upload_date'], 'slides_count': r['slides_count'],
            'description': r['description'] or '', 'tags': json.loads(r['tags']) if r['tags'] else []
        } for r in rows]
        return jsonify({'ppt_files': ppt_files})
    except Exception as e:
        logger.error(f"获取PPT文件失败: {e}")
        return jsonify({'error': str(e)}), 500


@ppt_bp.route('/files/<int:ppt_id>/download', methods=['GET'])
def download_ppt(ppt_id):
    # ... (此路由内容与原代码相同)
    try:
        row = get_db().execute('SELECT * FROM ppt_files WHERE id = ?', (ppt_id,)).fetchone()
        if not row: return jsonify({'error': 'PPT文件不存在'}), 404

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
def preview_ppt(ppt_id):
    """PPT文件预览"""
    try:
        preview_type = request.args.get('type', 'auto')
        
        row = get_db().execute('SELECT * FROM ppt_files WHERE id = ?', (ppt_id,)).fetchone()
        if not row:
            return jsonify({'error': 'PPT文件不存在'}), 404

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
def get_ppt_thumbnail(ppt_id):
    """获取PPT文件缩略图"""
    try:
        row = get_db().execute('SELECT * FROM ppt_files WHERE id = ?', (ppt_id,)).fetchone()
        if not row:
            return jsonify({'error': 'PPT文件不存在'}), 404

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
def get_ppt_slides(ppt_id):
    """获取PPT幻灯片列表"""
    try:
        row = get_db().execute('SELECT * FROM ppt_files WHERE id = ?', (ppt_id,)).fetchone()
        if not row:
            return jsonify({'error': 'PPT文件不存在'}), 404

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
def delete_ppt(ppt_id):
    """删除PPT文件"""
    try:
        row = get_db().execute('SELECT * FROM ppt_files WHERE id = ?', (ppt_id,)).fetchone()
        if not row:
            return jsonify({'error': 'PPT文件不存在'}), 404

        # 删除物理文件
        file_path = row['file_path']
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"删除物理文件: {file_path}")

        # 删除数据库记录
        db = get_db()
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
def batch_delete_ppts():
    """批量删除PPT文件"""
    try:
        data = request.get_json()
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
                row = db.execute('SELECT * FROM ppt_files WHERE id = ?', (ppt_id,)).fetchone()
                if row:
                    # 删除物理文件
                    file_path = row['file_path']
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    
                    # 删除数据库记录
                    db.execute('DELETE FROM ppt_files WHERE id = ?', (ppt_id,))
                    success_count += 1
                    logger.info(f"批量删除成功: {row['original_name']}")
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


@ppt_bp.route('/stats', methods=['GET'])
def get_ppt_stats():
    """获取PPT统计信息"""
    try:
        db = get_db()
        
        # 基本统计
        stats = db.execute('''
            SELECT 
                COUNT(*) as total_files,
                SUM(file_size) as total_size,
                SUM(slides_count) as total_slides,
                AVG(file_size) as avg_size
            FROM ppt_files
        ''').fetchone()

        # 按类型统计
        type_stats = db.execute('''
            SELECT file_type, COUNT(*) as count 
            FROM ppt_files 
            GROUP BY file_type 
            ORDER BY count DESC
        ''').fetchall()

        # 按日期统计（最近7天）
        recent_uploads = db.execute('''
            SELECT DATE(upload_date) as date, COUNT(*) as count
            FROM ppt_files 
            WHERE upload_date >= datetime('now', '-7 days')
            GROUP BY DATE(upload_date)
            ORDER BY date DESC
        ''').fetchall()

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
    
    # 截断文件名
    display_name = filename[:20] + '...' if len(filename) > 20 else filename
    
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