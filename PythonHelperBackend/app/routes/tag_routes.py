from flask import Blueprint, request, jsonify
from ..services.tag_service import TagService

tag_routes = Blueprint('tag_routes', __name__)
tag_service = TagService()

@tag_routes.route('/api/tags', methods=['GET'])
def get_all_tags():
    """获取所有标签"""
    try:
        tags = tag_service.get_all_tags()
        return jsonify({
            'success': True,
            'data': tags
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/tags/categories', methods=['GET'])
def get_tags_by_categories():
    """获取按类别分组的标签"""
    try:
        tags_by_category = tag_service.get_tags_by_categories()
        return jsonify({
            'success': True,
            'data': tags_by_category
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/tags/category/<category>', methods=['GET'])
def get_tags_by_category(category):
    """根据类别获取标签"""
    try:
        if category not in ['course', 'knowledge', 'difficulty']:
            return jsonify({
                'success': False,
                'error': 'Invalid category. Must be one of: course, knowledge, difficulty'
            }), 400
        
        tags = tag_service.get_tags_by_category(category)
        return jsonify({
            'success': True,
            'data': tags
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/tags', methods=['POST'])
def add_tag():
    """添加新标签"""
    try:
        data = request.get_json()
        if not data or 'name' not in data or 'category' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: name, category'
            }), 400
        
        name = data['name'].strip()
        category = data['category'].strip()
        
        if not name:
            return jsonify({
                'success': False,
                'error': 'Tag name cannot be empty'
            }), 400
        
        if category not in ['course', 'knowledge', 'difficulty']:
            return jsonify({
                'success': False,
                'error': 'Invalid category. Must be one of: course, knowledge, difficulty'
            }), 400
        
        result = tag_service.add_tag(name, category)
        if result['success']:
            return jsonify(result), 201
        else:
            return jsonify(result), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/tags/<int:tag_id>', methods=['PUT'])
def update_tag(tag_id):
    """更新标签"""
    try:
        data = request.get_json()
        if not data or 'name' not in data or 'category' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields: name, category'
            }), 400
        
        name = data['name'].strip()
        category = data['category'].strip()
        
        if not name:
            return jsonify({
                'success': False,
                'error': 'Tag name cannot be empty'
            }), 400
        
        if category not in ['course', 'knowledge', 'difficulty']:
            return jsonify({
                'success': False,
                'error': 'Invalid category. Must be one of: course, knowledge, difficulty'
            }), 400
        
        result = tag_service.update_tag(tag_id, name, category)
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/tags/<int:tag_id>', methods=['DELETE'])
def delete_tag(tag_id):
    """删除标签"""
    try:
        result = tag_service.delete_tag(tag_id)
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/tags/search', methods=['GET'])
def search_tags():
    """搜索标签"""
    try:
        query = request.args.get('q', '').strip()
        category = request.args.get('category', '').strip()
        
        if not query:
            return jsonify({
                'success': False,
                'error': 'Search query is required'
            }), 400
        
        if category and category not in ['course', 'knowledge', 'difficulty']:
            return jsonify({
                'success': False,
                'error': 'Invalid category. Must be one of: course, knowledge, difficulty'
            }), 400
        
        tags = tag_service.search_tags(query, category if category else None)
        return jsonify({
            'success': True,
            'data': tags
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/tags/statistics', methods=['GET'])
def get_tag_statistics():
    """获取标签统计信息"""
    try:
        stats = tag_service.get_tag_statistics()
        return jsonify({
            'success': True,
            'data': stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/mistakes/<int:mistake_id>/tags', methods=['GET'])
def get_mistake_tags(mistake_id):
    """获取错题的标签"""
    try:
        tags = tag_service.get_mistake_tags(mistake_id)
        return jsonify({
            'success': True,
            'data': tags
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@tag_routes.route('/api/mistakes/<int:mistake_id>/tags', methods=['PUT'])
def set_mistake_tags(mistake_id):
    """设置错题的标签"""
    try:
        data = request.get_json()
        if not data or 'tags' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required field: tags'
            }), 400
        
        tag_names = data['tags']
        if not isinstance(tag_names, list):
            return jsonify({
                'success': False,
                'error': 'Tags must be a list'
            }), 400
        
        result = tag_service.set_mistake_tags(mistake_id, tag_names)
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
