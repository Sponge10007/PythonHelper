from typing import List, Dict, Optional
from ..database import Database

class TagService:
    def __init__(self):
        self.db = Database()

    def get_all_tags(self) -> List[Dict]:
        """获取所有标签"""
        return self.db.get_all_tags()

    def get_tags_by_category(self, category: str) -> List[Dict]:
        """根据类别获取标签
        
        Args:
            category: 标签类别 ('course', 'knowledge', 'difficulty')
        """
        return self.db.get_tags_by_category(category)

    def get_tags_by_categories(self) -> Dict[str, List[Dict]]:
        """获取按类别分组的标签"""
        categories = ['course', 'knowledge', 'difficulty']
        result = {}
        
        for category in categories:
            result[category] = self.get_tags_by_category(category)
        
        return result

    def add_tag(self, name: str, category: str) -> Dict:
        """添加新标签
        
        Args:
            name: 标签名称
            category: 标签类别
            
        Returns:
            包含新标签信息的字典
        """
        try:
            tag_id = self.db.add_tag(name, category)
            return {
                'id': tag_id,
                'name': name,
                'category': category,
                'success': True
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def delete_tag(self, tag_id: int) -> Dict:
        """删除标签
        
        Args:
            tag_id: 标签ID
            
        Returns:
            操作结果字典
        """
        try:
            self.db.delete_tag(tag_id)
            return {'success': True}
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def update_tag(self, tag_id: int, name: str, category: str) -> Dict:
        """更新标签
        
        Args:
            tag_id: 标签ID
            name: 新标签名称
            category: 新标签类别
            
        Returns:
            操作结果字典
        """
        try:
            self.db.update_tag(tag_id, name, category)
            return {'success': True}
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def get_mistake_tags(self, mistake_id: int) -> List[Dict]:
        """获取错题的所有标签"""
        return self.db.get_mistake_tags(mistake_id)

    def set_mistake_tags(self, mistake_id: int, tag_names: List[str]) -> Dict:
        """设置错题的标签
        
        Args:
            mistake_id: 错题ID
            tag_names: 标签名称列表
            
        Returns:
            操作结果字典
        """
        try:
            # 根据标签名称获取标签ID
            all_tags = self.get_all_tags()
            tag_name_to_id = {tag['name']: tag['id'] for tag in all_tags}
            
            tag_ids = []
            for tag_name in tag_names:
                if tag_name in tag_name_to_id:
                    tag_ids.append(tag_name_to_id[tag_name])
                else:
                    # 如果标签不存在，可以选择创建或忽略
                    # 这里选择忽略不存在的标签
                    pass
            
            self.db.set_mistake_tags(mistake_id, tag_ids)
            return {'success': True}
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def search_tags(self, query: str, category: Optional[str] = None) -> List[Dict]:
        """搜索标签
        
        Args:
            query: 搜索关键词
            category: 可选的类别筛选
            
        Returns:
            匹配的标签列表
        """
        if category:
            sql_query = "SELECT id, name, category FROM tags WHERE name LIKE ? AND category = ? ORDER BY name"
            params = (f'%{query}%', category)
        else:
            sql_query = "SELECT id, name, category FROM tags WHERE name LIKE ? ORDER BY category, name"
            params = (f'%{query}%',)
        
        results = self.db.execute_query(sql_query, params)
        return [{'id': row[0], 'name': row[1], 'category': row[2]} for row in results]

    def get_tag_statistics(self) -> Dict:
        """获取标签统计信息"""
        stats = {}
        
        # 获取每个类别的标签数量
        categories = ['course', 'knowledge', 'difficulty']
        for category in categories:
            count = len(self.get_tags_by_category(category))
            stats[f'{category}_count'] = count
        
        # 获取总标签数量
        stats['total_count'] = sum(stats.values())
        
        # 获取最常用的标签（通过错题关联表统计）
        query = '''
            SELECT t.name, t.category, COUNT(mt.mistake_id) as usage_count
            FROM tags t
            LEFT JOIN mistake_tags mt ON t.id = mt.tag_id
            GROUP BY t.id
            ORDER BY usage_count DESC
            LIMIT 10
        '''
        results = self.db.execute_query(query)
        stats['most_used_tags'] = [
            {'name': row[0], 'category': row[1], 'count': row[2]}
            for row in results
        ]
        
        return stats
