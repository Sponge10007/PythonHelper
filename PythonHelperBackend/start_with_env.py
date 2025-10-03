#!/usr/bin/env python3
"""
快速启动后端服务的脚本
"""

import os
import subprocess
import sys
from pathlib import Path


def load_env_variables():
    """加载环境变量"""
    env_file = Path(__file__).parent / '.env'
    if env_file.exists():
        with open(env_file, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value
        print("✓ 已加载环境变量配置")
        print(f"  - FEISHU_APP_ID: {os.environ.get('FEISHU_APP_ID')}")
        secret = os.environ.get('FEISHU_APP_SECRET')[:10]
        print(f"  - FEISHU_APP_SECRET: {secret}...")
    else:
        print("⚠ 未找到 .env 文件")


def main():
    print("🚀 启动Python Helper后端服务...")
    
    # 加载环境变量
    load_env_variables()
    
    # 启动服务
    try:
        subprocess.run([sys.executable, 'run.py'], check=True)
    except KeyboardInterrupt:
        print("\n👋 服务已停止")
    except subprocess.CalledProcessError as e:
        print(f"❌ 服务启动失败: {e}")

if __name__ == "__main__":
    main()