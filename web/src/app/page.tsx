'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  Card,
  CardBody,
  CardHeader,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Button,
  ButtonGroup,
  Badge,
  Progress,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Tooltip
} from '@nextui-org/react'
import axios from 'axios'

const API_BASE = 'http://localhost:5000/api'

interface Backup {
  name: string
  path: string
  size: number
  size_human: string
  modified: string
}

interface SystemStatus {
  openclaw: { running: boolean; message: string }
  backup_dir: { exists: boolean; path: string }
  openclaw_dir: { exists: boolean; path: string }
}

export default function Dashboard() {
  const [backups, setBackups] = useState<Backup[]>([])
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [currentView, setCurrentView] = useState<'dashboard' | 'backups' | 'logs'>('dashboard')
  const { isOpen: isRestoreOpen, onOpen: onRestoreOpen, onClose: onRestoreClose } = useDisclosure()
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure()
  const [selectedBackup, setSelectedBackup] = useState<string>('')
  const [operationMessage, setOperationMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchBackups = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/backups`)
      if (res.data.success) {
        setBackups(res.data.backups)
      }
    } catch (err) {
      console.error('获取备份列表失败', err)
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/status`)
      setStatus(res.data)
    } catch (err) {
      console.error('获取状态失败', err)
    }
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/logs`)
      if (res.data.success) {
        setLogs(res.data.logs.reverse())
      }
    } catch (err) {
      console.error('获取日志失败', err)
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    await Promise.all([fetchBackups(), fetchStatus(), fetchLogs()])
    setLoading(false)
  }, [fetchBackups, fetchStatus, fetchLogs])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30000)
    return () => clearInterval(interval)
  }, [refresh])

  const handleBackup = async () => {
    setActionLoading(true)
    setOperationMessage(null)
    try {
      const res = await axios.post(`${API_BASE}/backup`)
      if (res.data.success) {
        setOperationMessage({ type: 'success', message: '备份成功！' })
        setBackups(res.data.backups)
        await fetchLogs()
      } else {
        setOperationMessage({ type: 'error', message: res.data.message || '备份失败' })
      }
    } catch (err: any) {
      setOperationMessage({ type: 'error', message: err.response?.data?.message || '备份失败' })
    }
    setActionLoading(false)
  }

  const handleRestore = async () => {
    setActionLoading(true)
    setOperationMessage(null)
    onRestoreClose()
    try {
      const res = await axios.post(`${API_BASE}/restore`, { filename: selectedBackup })
      if (res.data.success) {
        setOperationMessage({ type: 'success', message: `恢复成功！已恢复到 ${selectedBackup}` })
      } else {
        setOperationMessage({ type: 'error', message: res.data.message || '恢复失败' })
      }
    } catch (err: any) {
      setOperationMessage({ type: 'error', message: err.response?.data?.message || '恢复失败' })
    }
    setActionLoading(false)
  }

  const handleDelete = async () => {
    setActionLoading(true)
    setOperationMessage(null)
    onDeleteClose()
    try {
      const res = await axios.delete(`${API_BASE}/backup/${selectedBackup}`)
      if (res.data.success) {
        setOperationMessage({ type: 'success', message: `已删除 ${selectedBackup}` })
        await fetchBackups()
      } else {
        setOperationMessage({ type: 'error', message: res.data.message || '删除失败' })
      }
    } catch (err: any) {
      setOperationMessage({ type: 'error', message: err.response?.data?.message || '删除失败' })
    }
    setActionLoading(false)
  }

  const openRestoreModal = (name: string) => {
    setSelectedBackup(name)
    onRestoreOpen()
  }

  const openDeleteModal = (name: string) => {
    setSelectedBackup(name)
    onDeleteOpen()
  }

  const parseLog = (log: string): { time: string; message: string; type: 'info' | 'success' | 'error' } => {
    const match = log.match(/^\[(.*?)\]\s*(.*)$/)
    if (match) {
      const [, time, message] = match
      let type: 'info' | 'success' | 'error' = 'info'
      if (message.includes('成功') || message.includes('完成') || message.includes('已启动')) {
        type = 'success'
      } else if (message.includes('失败') || message.includes('错误')) {
        type = 'error'
      }
      return { time, message, type }
    }
    return { time: '', message: log, type: 'info' }
  }

  const renderDashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <Card className="bg-slate-800/50">
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">备份总数</p>
              <p className="text-3xl font-bold">{backups.length}</p>
            </div>
            <div className="text-4xl opacity-50">💾</div>
          </div>
        </CardBody>
      </Card>

      <Card className="bg-slate-800/50">
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">最新备份</p>
              <p className="text-lg font-semibold truncate">
                {backups[0]?.modified || '暂无'}
              </p>
            </div>
            <div className="text-4xl opacity-50">📅</div>
          </div>
        </CardBody>
      </Card>

      <Card className="bg-slate-800/50">
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">OpenClaw 状态</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge color={status?.openclaw?.running ? 'success' : 'danger'} size="sm">
                  {status?.openclaw?.message || '检查中'}
                </Badge>
              </div>
            </div>
            <div className="text-4xl opacity-50">🖥️</div>
          </div>
        </CardBody>
      </Card>

      <Card className="bg-slate-800/50">
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">存储占用</p>
              <p className="text-lg font-semibold">
                {backups.reduce((acc, b) => acc + b.size, 0) > 0
                  ? (backups.reduce((acc, b) => acc + b.size, 0) / 1024 / 1024).toFixed(1) + ' MB'
                  : '0 MB'}
              </p>
            </div>
            <div className="text-4xl opacity-50">📦</div>
          </div>
        </CardBody>
      </Card>
    </div>
  )

  const renderBackups = () => (
    <Card className="bg-slate-800/50">
      <CardHeader className="flex justify-between items-center">
        <h2 className="text-xl font-bold">备份列表</h2>
        <Button
          color="primary"
          onPress={handleBackup}
          isLoading={actionLoading}
        >
          立即备份
        </Button>
      </CardHeader>
      <CardBody>
        <Table aria-label="备份列表" className="scrollbar-thin">
          <TableHeader>
            <TableColumn>文件名</TableColumn>
            <TableColumn>大小</TableColumn>
            <TableColumn>修改时间</TableColumn>
            <TableColumn>操作</TableColumn>
          </TableHeader>
          <TableBody>
            {backups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                  暂无备份记录
                </TableCell>
              </TableRow>
            ) : (
              backups.map((backup) => (
                <TableRow key={backup.name}>
                  <TableCell>
                    <code className="bg-slate-700 px-2 py-1 rounded text-sm">{backup.name}</code>
                  </TableCell>
                  <TableCell>{backup.size_human}</TableCell>
                  <TableCell>{backup.modified}</TableCell>
                  <TableCell>
                    <ButtonGroup size="sm">
                      <Tooltip content="恢复此备份">
                        <Button
                          color="success"
                          variant="flat"
                          onPress={() => openRestoreModal(backup.name)}
                        >
                          恢复
                        </Button>
                      </Tooltip>
                      <Tooltip content="删除备份">
                        <Button
                          color="danger"
                          variant="flat"
                          onPress={() => openDeleteModal(backup.name)}
                        >
                          删除
                        </Button>
                      </Tooltip>
                    </ButtonGroup>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  )

  const renderLogs = () => (
    <Card className="bg-slate-800/50">
      <CardHeader className="flex justify-between items-center">
        <h2 className="text-xl font-bold">操作日志</h2>
        <Button
          size="sm"
          variant="flat"
          onPress={fetchLogs}
          isLoading={loading}
        >
          刷新
        </Button>
      </CardHeader>
      <CardBody>
        <div className="bg-black/30 rounded-lg p-4 h-[400px] overflow-y-auto scrollbar-thin font-mono text-sm">
          {logs.length === 0 ? (
            <p className="text-slate-400 text-center py-8">暂无日志记录</p>
          ) : (
            logs.map((log, index) => {
              const { time, message, type } = parseLog(log)
              return (
                <div key={index} className="py-1">
                  <span className="text-slate-500">[{time}]</span>{' '}
                  <span className={
                    type === 'success' ? 'text-green-400' :
                    type === 'error' ? 'text-red-400' : 'text-slate-300'
                  }>
                    {message}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </CardBody>
    </Card>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
              OpenClaw 备份管理系统
            </h1>
            <p className="text-slate-400 mt-1">自动备份 · GitHub 云同步 · 一键恢复</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={currentView === 'dashboard' ? 'solid' : 'flat'}
              color={currentView === 'dashboard' ? 'primary' : 'default'}
              onPress={() => setCurrentView('dashboard')}
            >
              仪表盘
            </Button>
            <Button
              variant={currentView === 'backups' ? 'solid' : 'flat'}
              color={currentView === 'backups' ? 'primary' : 'default'}
              onPress={() => setCurrentView('backups')}
            >
              备份列表
            </Button>
            <Button
              variant={currentView === 'logs' ? 'solid' : 'flat'}
              color={currentView === 'logs' ? 'primary' : 'default'}
              onPress={() => setCurrentView('logs')}
            >
              日志
            </Button>
          </div>
        </div>

        {/* Operation Message */}
        {operationMessage && (
          <Card className={`mb-4 ${operationMessage.type === 'success' ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
            <CardBody className="flex flex-row items-center gap-2">
              <span>{operationMessage.type === 'success' ? '✅' : '❌'}</span>
              <span>{operationMessage.message}</span>
              <Button size="sm" variant="light" onPress={() => setOperationMessage(null)}>
                关闭
              </Button>
            </CardBody>
          </Card>
        )}

        {/* Loading */}
        {loading && <Progress size="sm" isIndeterminate color="primary" className="mb-4" />}

        {/* Quick Actions */}
        <Card className="bg-slate-800/50 mb-8">
          <CardBody>
            <div className="flex flex-wrap gap-4">
              <Button
                color="primary"
                size="lg"
                onPress={handleBackup}
                isLoading={actionLoading}
              >
                💾 立即备份
              </Button>
              <Button
                color="success"
                size="lg"
                onPress={() => backups[0] && openRestoreModal('latest')}
                isDisabled={backups.length === 0}
              >
                🔄 恢复最新
              </Button>
              <Button
                variant="flat"
                size="lg"
                onPress={refresh}
                isLoading={loading}
              >
                🔃 刷新状态
              </Button>
            </div>
          </CardBody>
        </Card>

        {/* Content */}
        {currentView === 'dashboard' && renderDashboard()}
        {currentView === 'backups' && renderBackups()}
        {currentView === 'logs' && renderLogs()}

        {/* Restore Modal */}
        <Modal isOpen={isRestoreOpen} onClose={onRestoreClose}>
          <ModalContent>
            <ModalHeader>确认恢复</ModalHeader>
            <ModalBody>
              <p>确定要恢复备份: <code className="bg-slate-700 px-2 py-1 rounded text-sm">{selectedBackup}</code> 吗？</p>
              <p className="text-sm text-yellow-400 mt-2">
                ⚠️ 恢复前会创建临时备份，恢复过程中 OpenClaw 将短暂停止。
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onRestoreClose}>
                取消
              </Button>
              <Button color="success" onPress={handleRestore} isLoading={actionLoading}>
                确认恢复
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Delete Modal */}
        <Modal isOpen={isDeleteOpen} onClose={onDeleteClose}>
          <ModalContent>
            <ModalHeader>确认删除</ModalHeader>
            <ModalBody>
              <p>确定要删除备份: <code className="bg-slate-700 px-2 py-1 rounded text-sm">{selectedBackup}</code> 吗？</p>
              <p className="text-sm text-red-400 mt-2">
                ⚠️ 此操作不可恢复，请谨慎确认！
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onDeleteClose}>
                取消
              </Button>
              <Button color="danger" onPress={handleDelete} isLoading={actionLoading}>
                确认删除
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

        {/* Footer */}
        <div className="text-center text-slate-500 text-sm mt-8">
          <p>OpenClaw Backup System v1.0 | API: http://localhost:5000</p>
        </div>
      </div>
    </div>
  )
}
