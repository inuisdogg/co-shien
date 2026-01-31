/**
 * TaskManagementView - タスク管理
 * 施設から割り当てられたタスクの管理
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardList, Plus, Calendar, ChevronRight, CheckCircle, Circle, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Task {
  id: string;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in_progress' | 'completed';
  dueDate?: string;
  assignedBy?: string;
  createdAt: string;
  completedAt?: string;
}

interface TaskManagementViewProps {
  userId: string;
  facilityId: string;
  facilityName: string;
  onBack: () => void;
}

export default function TaskManagementView({ userId, facilityId, facilityName, onBack }: TaskManagementViewProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');

  useEffect(() => {
    loadTasks();
  }, [userId, facilityId]);

  const loadTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('staff_tasks')
        .select('*')
        .eq('assigned_to', userId)
        .eq('facility_id', facilityId)
        .order('due_date', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTasks((data || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        description: t.description || '',
        priority: t.priority || 'medium',
        status: t.status || 'pending',
        dueDate: t.due_date,
        assignedBy: t.assigned_by_name,
        createdAt: t.created_at,
        completedAt: t.completed_at,
      })));
    } catch (err) {
      console.error('タスク取得エラー:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status']) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('staff_tasks')
        .update(updateData)
        .eq('id', taskId);

      if (error) throw error;

      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, status: newStatus, completedAt: newStatus === 'completed' ? new Date().toISOString() : t.completedAt } : t
      ));

      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (err) {
      console.error('ステータス更新エラー:', err);
      alert('更新に失敗しました');
    }
  };

  const priorityConfig = {
    high: { label: '高', color: 'bg-red-100 text-red-700' },
    medium: { label: '中', color: 'bg-yellow-100 text-yellow-700' },
    low: { label: '低', color: 'bg-green-100 text-green-700' },
  };

  const statusConfig = {
    pending: { label: '未着手', color: 'bg-gray-100 text-gray-600', icon: Circle },
    in_progress: { label: '進行中', color: 'bg-blue-100 text-blue-600', icon: Clock },
    completed: { label: '完了', color: 'bg-green-100 text-green-600', icon: CheckCircle },
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    return t.status === filter;
  });

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date() && !['completed'].includes(filter);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#818CF8]" />
      </div>
    );
  }

  if (selectedTask) {
    const priority = priorityConfig[selectedTask.priority];
    const status = statusConfig[selectedTask.status];
    const StatusIcon = status.icon;

    return (
      <div className="space-y-4">
        <button
          onClick={() => setSelectedTask(null)}
          className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
        >
          <span>&#8592;</span> 一覧に戻る
        </button>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${priority.color}`}>
                  優先度: {priority.label}
                </span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${status.color}`}>
                  <StatusIcon className="w-3 h-3" />
                  {status.label}
                </span>
              </div>
              <h2 className="text-xl font-bold text-gray-800">{selectedTask.title}</h2>
            </div>
          </div>

          <div className="space-y-4">
            {selectedTask.dueDate && (
              <div className={`flex items-center gap-2 text-sm ${isOverdue(selectedTask.dueDate) ? 'text-red-600' : 'text-gray-600'}`}>
                <Calendar className="w-4 h-4" />
                期限: {new Date(selectedTask.dueDate).toLocaleDateString('ja-JP')}
                {isOverdue(selectedTask.dueDate) && selectedTask.status !== 'completed' && (
                  <span className="flex items-center gap-1 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    期限超過
                  </span>
                )}
              </div>
            )}

            {selectedTask.description && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-bold text-gray-700 mb-2">詳細</p>
                <p className="text-gray-600 whitespace-pre-wrap">{selectedTask.description}</p>
              </div>
            )}

            {selectedTask.assignedBy && (
              <p className="text-sm text-gray-500">
                担当者設定: {selectedTask.assignedBy}
              </p>
            )}

            {selectedTask.status !== 'completed' && (
              <div className="flex gap-3 pt-4">
                {selectedTask.status === 'pending' && (
                  <button
                    onClick={() => updateTaskStatus(selectedTask.id, 'in_progress')}
                    className="flex-1 py-3 px-4 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600"
                  >
                    着手する
                  </button>
                )}
                <button
                  onClick={() => updateTaskStatus(selectedTask.id, 'completed')}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-green-500 text-white font-bold rounded-lg hover:bg-green-600"
                >
                  <CheckCircle className="w-4 h-4" />
                  完了にする
                </button>
              </div>
            )}

            {selectedTask.completedAt && (
              <p className="text-sm text-green-600">
                完了日時: {new Date(selectedTask.completedAt).toLocaleString('ja-JP')}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = tasks.filter(t => t.status === 'pending').length;
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length;

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-[#818CF8] font-bold hover:underline"
      >
        <span>&#8592;</span> 業務ツールに戻る
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ClipboardList className="w-6 h-6 text-[#818CF8]" />
              <div>
                <h2 className="text-lg font-bold text-gray-800">タスク管理</h2>
                <p className="text-sm text-gray-500">{facilityName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="px-2 py-1 bg-gray-100 rounded">
                未着手: <span className="font-bold">{pendingCount}</span>
              </span>
              <span className="px-2 py-1 bg-blue-100 rounded text-blue-700">
                進行中: <span className="font-bold">{inProgressCount}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex gap-2 flex-wrap">
            {(['all', 'pending', 'in_progress', 'completed'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1 rounded-full text-sm font-bold transition-colors ${
                  filter === f ? 'bg-[#818CF8] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f === 'all' ? 'すべて' : f === 'pending' ? '未着手' : f === 'in_progress' ? '進行中' : '完了'}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {filteredTasks.length > 0 ? (
            <div className="space-y-2">
              {filteredTasks.map((task) => {
                const priority = priorityConfig[task.priority];
                const status = statusConfig[task.status];
                const StatusIcon = status.icon;
                const overdue = isOverdue(task.dueDate) && task.status !== 'completed';

                return (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg transition-colors ${
                      overdue ? 'bg-red-50 hover:bg-red-100' : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <StatusIcon className={`w-5 h-5 ${task.status === 'completed' ? 'text-green-500' : task.status === 'in_progress' ? 'text-blue-500' : 'text-gray-400'}`} />
                      <div className="text-left">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${priority.color}`}>
                            {priority.label}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${status.color}`}>
                            {status.label}
                          </span>
                          {overdue && (
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-500 text-white">
                              期限超過
                            </span>
                          )}
                        </div>
                        <p className={`font-bold ${task.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                          {task.title}
                        </p>
                        {task.dueDate && (
                          <p className={`text-xs ${overdue ? 'text-red-500' : 'text-gray-500'}`}>
                            期限: {new Date(task.dueDate).toLocaleDateString('ja-JP')}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">タスクはありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
