import os
import shutil
import pathlib

def clean_pycache(root_dir):
    """
    递归清理项目中的 __pycache__ 文件夹和 .pyc 文件
    """
    print(f"Starting cleanup in: {root_dir}")
    deleted_dirs = 0
    deleted_files = 0

    for current_dir, dirs, files in os.walk(root_dir):
        # 1. 清理 __pycache__ 目录
        if '__pycache__' in dirs:
            pycache_path = os.path.join(current_dir, '__pycache__')
            try:
                shutil.rmtree(pycache_path)
                print(f"Deleted directory: {pycache_path}")
                deleted_dirs += 1
            except Exception as e:
                print(f"Error deleting {pycache_path}: {e}")
            dirs.remove('__pycache__')  # 不需要继续遍历已被删除的目录

        # 2. 清理散落的 .pyc 文件 (以防万一)
        for file in files:
            if file.endswith('.pyc') or file.endswith('.pyo'):
                file_path = os.path.join(current_dir, file)
                try:
                    os.remove(file_path)
                    print(f"Deleted file: {file_path}")
                    deleted_files += 1
                except Exception as e:
                    print(f"Error deleting {file_path}: {e}")

    print("-" * 30)
    print(f"Cleanup complete.")
    print(f"Removed {deleted_dirs} '__pycache__' directories.")
    print(f"Removed {deleted_files} .pyc files.")

if __name__ == "__main__":
    # 获取当前脚本所在目录
    current_directory = os.getcwd()
    
    # 确认提示
    print("This script will recursively delete all '__pycache__' folders and '.pyc' files in:")
    print(current_directory)
    confirm = input("Are you sure? (y/n): ")
    
    if confirm.lower() == 'y':
        clean_pycache(current_directory)
    else:
        print("Operation cancelled.")