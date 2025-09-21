#!/usr/bin/env python3
"""
PPT功能测试脚本
用于测试完整的PPT上传、预览、删除功能
"""

import requests
import json
import os
import time

# 后端API基础URL
BASE_URL = "http://localhost:5000"
PPT_API = f"{BASE_URL}/ppt"

def test_api_connection():
    """测试API连接"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        if response.status_code == 200:
            print("✅ API连接正常")
            return True
        else:
            print(f"❌ API连接失败: {response.status_code}")
            return False
    except requests.exceptions.RequestException as e:
        print(f"❌ API连接错误: {e}")
        return False

def test_ppt_upload():
    """测试PPT文件上传"""
    print("\n📤 测试PPT文件上传...")
    
    # 创建测试文件
    test_file_path = "/tmp/test_presentation.txt"
    with open(test_file_path, 'w', encoding='utf-8') as f:
        f.write("这是一个测试PPT文件\n包含一些示例内容\n用于测试上传功能")
    
    try:
        with open(test_file_path, 'rb') as f:
            files = {'file': ('test_presentation.ppt', f, 'application/vnd.ms-powerpoint')}
            data = {
                'description': '测试PPT文件',
                'tags': json.dumps(['测试', 'PPT', '功能验证'])
            }
            
            response = requests.post(f"{PPT_API}/upload", files=files, data=data)
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ 上传成功，文件ID: {result.get('ppt_id')}")
                return result.get('ppt_id')
            else:
                print(f"❌ 上传失败: {response.status_code} - {response.text}")
                return None
                
    except Exception as e:
        print(f"❌ 上传错误: {e}")
        return None
    finally:
        # 清理测试文件
        if os.path.exists(test_file_path):
            os.remove(test_file_path)

def test_ppt_list():
    """测试PPT文件列表"""
    print("\n📋 测试PPT文件列表...")
    
    try:
        response = requests.get(f"{PPT_API}/files")
        
        if response.status_code == 200:
            response_data = response.json()
            files = response_data.get('ppt_files', [])
            print(f"✅ 获取文件列表成功，共 {len(files)} 个文件")
            
            for file_info in files[:3]:  # 只显示前3个
                print(f"   - {file_info['original_name']} (ID: {file_info['id']})")
            
            return files
        else:
            print(f"❌ 获取列表失败: {response.status_code}")
            return []
            
    except Exception as e:
        print(f"❌ 获取列表错误: {e}")
        return []

def test_ppt_preview(file_id):
    """测试PPT文件预览"""
    print(f"\n🔍 测试PPT文件预览 (ID: {file_id})...")
    
    try:
        # 测试预览信息
        response = requests.get(f"{PPT_API}/files/{file_id}/preview")
        
        if response.status_code == 200:
            preview_info = response.json()
            print("✅ 预览信息获取成功:")
            print(f"   - 预览URL: {preview_info.get('preview_url', 'N/A')}")
            print(f"   - 文件类型: {preview_info.get('file_type', 'N/A')}")
            print(f"   - 原始名称: {preview_info.get('original_name', 'N/A')}")
        else:
            print(f"❌ 预览失败: {response.status_code}")
            
        # 测试缩略图
        thumbnail_response = requests.get(f"{PPT_API}/files/{file_id}/thumbnail")
        if thumbnail_response.status_code == 200:
            print("✅ 缩略图获取成功")
        else:
            print(f"❌ 缩略图获取失败: {thumbnail_response.status_code}")
            
    except Exception as e:
        print(f"❌ 预览错误: {e}")

def test_ppt_stats():
    """测试PPT统计信息"""
    print("\n📊 测试PPT统计信息...")
    
    try:
        response = requests.get(f"{PPT_API}/stats")
        
        if response.status_code == 200:
            stats = response.json()
            print("✅ 统计信息获取成功:")
            print(f"   - 总文件数: {stats.get('total_files', 0)}")
            print(f"   - 总大小: {stats.get('total_size', 0)} bytes")
            print(f"   - 总幻灯片: {stats.get('total_slides', 0)}")
            
            if stats.get('type_distribution'):
                print("   - 类型分布:")
                for type_info in stats['type_distribution']:
                    print(f"     * {type_info['file_type']}: {type_info['count']} 个")
        else:
            print(f"❌ 统计信息获取失败: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 统计信息错误: {e}")

def test_ppt_delete(file_id):
    """测试PPT文件删除"""
    if not file_id:
        print("\n🗑️  跳过删除测试 (没有有效的文件ID)")
        return
        
    print(f"\n🗑️  测试PPT文件删除 (ID: {file_id})...")
    
    # 询问用户是否执行删除
    confirm = input("是否执行删除测试? (y/N): ").strip().lower()
    if confirm != 'y':
        print("跳过删除测试")
        return
    
    try:
        response = requests.delete(f"{PPT_API}/files/{file_id}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ 删除成功: {result.get('message', '文件已删除')}")
        else:
            print(f"❌ 删除失败: {response.status_code}")
            
    except Exception as e:
        print(f"❌ 删除错误: {e}")

def main():
    """主测试函数"""
    print("🚀 PPT功能完整性测试")
    print("=" * 50)
    
    # 1. 测试API连接
    if not test_api_connection():
        print("\n❌ 无法连接到后端API，请确保后端服务正在运行")
        return
    
    # 2. 测试上传功能
    uploaded_file_id = test_ppt_upload()
    
    # 3. 测试文件列表
    files = test_ppt_list()
    
    # 4. 测试预览功能
    if uploaded_file_id:
        test_ppt_preview(uploaded_file_id)
    elif files:
        # 使用现有文件进行预览测试
        test_ppt_preview(files[0]['id'])
    
    # 5. 测试统计信息
    test_ppt_stats()
    
    # 6. 测试删除功能
    test_ppt_delete(uploaded_file_id)
    
    print("\n" + "=" * 50)
    print("🏁 PPT功能测试完成")
    
    # 给出前端测试建议
    print("\n📋 前端测试建议:")
    print("1. 打开Chrome浏览器开发者工具")
    print("2. 加载扩展并打开PPT管理页面")
    print("3. 测试文件上传、预览、删除等功能")
    print("4. 检查控制台是否有JavaScript错误")
    print("5. 验证tag显示是否正常（已修复 ppt.tags.map 错误）")

if __name__ == "__main__":
    main()