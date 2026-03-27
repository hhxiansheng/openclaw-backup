#!/usr/bin/env python3
"""
OpenClaw 备份系统 - Flask API 服务
Author: DevOps Engineer (AI Assistant)
"""

import os
import sys
import subprocess
import json
from datetime import datetime
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# 配置
BACKUP_DIR = os.path.expanduser("~/openclaw-backup/backups")
SCRIPTS_DIR = os.path.expanduser("~/openclaw-backup/scripts")
LOG_FILE = os.path.expanduser("~/openclaw-backup/backup.log")
OPENCLAW_DIR = os.path.expanduser("~/.openclaw")

def log(msg):
    """写入日志"""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_FILE, "a") as f:
        f.write(f"[{timestamp}] {msg}\n")

def get_backup_list():
    """获取备份列表"""
    if not os.path.exists(BACKUP_DIR):
        return []
    
    backups = []
    for f in os.listdir(BACKUP_DIR):
        if f.startswith("backup-") and f.endswith(".tar.gz"):
            path = os.path.join(BACKUP_DIR, f)
            stat = os.stat(path)
            backups.append({
                "name": f,
                "path": path,
                "size": stat.st_size,
                "size_human": get_size_human(stat.st_size),
                "modified": datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
            })
    
    # 按修改时间排序，最新的在前
    backups.sort(key=lambda x: x["modified"], reverse=True)
    return backups

def get_size_human(size):
    """获取人类可读的文件大小"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size < 1024.0:
            return f"{size:.1f} {unit}"
        size /= 1024.0
    return f"{size:.1f} TB"

def run_script(script_name, *args):
    """运行脚本"""
    script_path = os.path.join(SCRIPTS_DIR, script_name)
    cmd = [script_path] + list(args)
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600)
        return result.returncode, result.stdout, result.stderr
    except subprocess.TimeoutExpired:
        return 1, "", "脚本执行超时"
    except Exception as e:
        return 1, "", str(e)

def get_system_status():
    """获取系统状态"""
    status = {
        "openclaw": {
            "running": False,
            "message": "未运行"
        },
        "backup_dir": {
            "exists": os.path.exists(BACKUP_DIR),
            "path": BACKUP_DIR
        },
        "openclaw_dir": {
            "exists": os.path.exists(OPENCLAW_DIR),
            "path": OPENCLAW_DIR
        }
    }
    
    # 检查 OpenClaw 是否运行
    try:
        result = subprocess.run(["pgrep", "-f", "openclaw"], capture_output=True)
        status["openclaw"]["running"] = result.returncode == 0
        status["openclaw"]["message"] = "运行中" if result.returncode == 0 else "未运行"
    except:
        pass
    
    return status

@app.route("/")
def index():
    return jsonify({
        "service": "OpenClaw Backup API",
        "version": "1.0.0",
        "endpoints": [
            "GET /api/backups - 获取备份列表",
            "POST /api/backup - 执行备份",
            "POST /api/restore - 恢复备份",
            "DELETE /api/backup - 删除备份",
            "GET /api/logs - 获取日志",
            "GET /api/status - 系统状态"
        ]
    })

@app.route("/api/status")
def api_status():
    """获取系统状态"""
    return jsonify(get_system_status())

@app.route("/api/backups")
def api_backups():
    """获取备份列表"""
    backups = get_backup_list()
    return jsonify({
        "success": True,
        "count": len(backups),
        "backups": backups
    })

@app.route("/api/backup", methods=["POST"])
def api_backup():
    """执行备份"""
    log("API: 收到备份请求")
    
    # 执行备份脚本
    returncode, stdout, stderr = run_script("backup.sh")
    
    if returncode == 0:
        log("API: 备份成功")
        backups = get_backup_list()
        return jsonify({
            "success": True,
            "message": "备份成功",
            "backups": backups
        })
    else:
        log(f"API: 备份失败 - {stderr}")
        return jsonify({
            "success": False,
            "message": f"备份失败: {stderr}",
            "stdout": stdout,
            "stderr": stderr
        }), 500

@app.route("/api/restore", methods=["POST"])
def api_restore():
    """恢复备份"""
    data = request.get_json()
    filename = data.get("filename")
    
    if not filename:
        return jsonify({
            "success": False,
            "message": "缺少 filename 参数"
        }), 400
    
    log(f"API: 收到恢复请求 - {filename}")
    
    # 执行恢复脚本
    returncode, stdout, stderr = run_script("restore.sh", filename)
    
    if returncode == 0:
        log(f"API: 恢复成功 - {filename}")
        return jsonify({
            "success": True,
            "message": f"恢复成功: {filename}",
            "stdout": stdout
        })
    else:
        log(f"API: 恢复失败 - {stderr}")
        return jsonify({
            "success": False,
            "message": f"恢复失败: {stderr}",
            "stdout": stdout,
            "stderr": stderr
        }), 500

@app.route("/api/backup/<filename>", methods=["DELETE"])
def api_delete_backup(filename):
    """删除备份"""
    # 安全检查
    if ".." in filename or "/" in filename:
        return jsonify({
            "success": False,
            "message": "无效的文件名"
        }), 400
    
    backup_path = os.path.join(BACKUP_DIR, filename)
    
    if not os.path.exists(backup_path):
        return jsonify({
            "success": False,
            "message": "备份文件不存在"
        }), 404
    
    try:
        os.remove(backup_path)
        log(f"API: 删除备份成功 - {filename}")
        
        # 同时尝试从 GitHub 删除（如果配置了）
        # 这里简化处理，实际可能需要 git 操作
        
        return jsonify({
            "success": True,
            "message": f"删除成功: {filename}"
        })
    except Exception as e:
        log(f"API: 删除备份失败 - {str(e)}")
        return jsonify({
            "success": False,
            "message": f"删除失败: {str(e)}"
        }), 500

@app.route("/api/logs")
def api_logs():
    """获取日志"""
    if not os.path.exists(LOG_FILE):
        return jsonify({
            "success": True,
            "logs": [],
            "message": "暂无日志"
        })
    
    try:
        with open(LOG_FILE, "r") as f:
            lines = f.readlines()
        
        # 返回最后100行
        recent_lines = lines[-100:] if len(lines) > 100 else lines
        
        return jsonify({
            "success": True,
            "logs": [line.strip() for line in recent_lines],
            "total": len(lines)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "message": f"读取日志失败: {str(e)}"
        }), 500

@app.route("/api/cleanup", methods=["POST"])
def api_cleanup():
    """执行清理"""
    log("API: 收到清理请求")
    
    returncode, stdout, stderr = run_script("cleanup.sh")
    
    if returncode == 0:
        log("API: 清理成功")
        return jsonify({
            "success": True,
            "message": "清理成功",
            "stdout": stdout
        })
    else:
        log(f"API: 清理失败 - {stderr}")
        return jsonify({
            "success": False,
            "message": f"清理失败: {stderr}"
        }), 500

if __name__ == "__main__":
    # 确保目录存在
    os.makedirs(BACKUP_DIR, exist_ok=True)
    
    print("=" * 50)
    print("OpenClaw 备份系统 API 服务")
    print("=" * 50)
    print(f"备份目录: {BACKUP_DIR}")
    print(f"日志文件: {LOG_FILE}")
    print(f"API 地址: http://localhost:5000")
    print("=" * 50)
    
    # 启动服务
    app.run(host="0.0.0.0", port=5000, debug=False)
