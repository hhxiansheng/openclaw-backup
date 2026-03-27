#!/bin/bash
# OpenClaw 自动备份脚本 (简化版)
# Author: DevOps Engineer (AI Assistant)

# 配置
BACKUP_DIR="$HOME/openclaw-backup/backups"
OPENCLAW_DIR="$HOME/.openclaw"
LOG_FILE="$HOME/openclaw-backup/backup.log"
RETENTION_DAYS=3

# 日志函数
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# 创建备份
create_backup() {
    local backup_filename="backup-$(date '+%Y-%m-%d').tar.gz"
    local backup_path="$BACKUP_DIR/$backup_filename"
    
    log "开始创建备份: $backup_filename"
    
    # 确保备份目录存在
    mkdir -p "$BACKUP_DIR"
    
    # 创建备份（跳过可能锁定的文件）
    tar -czf "$backup_path" \
        -C "$HOME" \
        --exclude='.openclaw/workspace/node_modules' \
        --exclude='.openclaw/workspace/.git' \
        --exclude='.openclaw/workspace/venv' \
        --exclude='.openclaw/workspace/.next' \
        --exclude='.npm-global/lib/node_modules/.cache' \
        .openclaw 2>/dev/null || \
    tar -czf "$backup_path" \
        -C "$HOME" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='venv' \
        --exclude='.next' \
        .openclaw 2>/dev/null || {
        log "错误: 备份创建失败"
        return 1
    }
    
    # 获取文件大小
    local size=$(du -h "$backup_path" | cut -f1)
    log "备份创建成功: $backup_path (大小: $size)"
    
    echo "$backup_filename"
}

# 清理旧备份
cleanup_old() {
    log "正在清理超过 $RETENTION_DAYS 天的备份..."
    find "$BACKUP_DIR" -name "backup-*.tar.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    log "清理完成"
}

# 主函数
main() {
    log "========== 开始备份任务 =========="
    
    # 创建备份
    local backup_file=$(create_backup)
    
    # 清理旧备份
    cleanup_old
    
    log "========== 备份任务完成 =========="
}

# 执行
main "$@"
