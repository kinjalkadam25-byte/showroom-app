import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import ReminderForm from './ReminderForm'

const TYPE_LABELS = {
  general:    'General',
  service:    'Service',
  payment:    'Payment',
  follow_up:  'Follow Up',
}

const TYPE_STYLES = {
  general:   'bg-gray-100 text-gray-600',
  service:   'bg-blue-100 text-blue-700',
  payment:   'bg-purple-100 text-purple-700',
  follow_up: 'bg-orange-100 text-orange-700',
}

function getStatus(reminder) {
  if (reminder.completed) return 'done'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(reminder.due_date)
  if (due < today)  return 'overdue'
  if (due.toDateString() === today.toDateString()) return 'today'
  return 'upcoming'
}

const STATUS_STYLES = {
  overdue:  'bg-red-100 text-red-600',
  today:    'bg-orange-100 text-orange-700',
  upcoming: 'bg-blue-50 text-blue-600',
  done:     'bg-green-100 text-green-700',
}

const STATUS_LABELS = {
  overdue:  'Overdue',
  today:    'Due Today',
  upcoming: 'Upcoming',
  done:     'Done',
}

const STATUS_SORT = { overdue: 0, today: 1, upcoming: 2, done: 3 }

export default function ReminderList() {
  const [reminders, setReminders]       = useState([])
  const [loading, setLoading]           = useState(true)
  const [filter, setFilter]             = useState('pending') // 'pending' | 'done' | 'all'
  const [showForm, setShowForm]         = useState(false)
  const [editingReminder, setEditingReminder] = useState(null)

  useEffect(() => { fetchReminders() }, [])

  async function fetchReminders() {
    setLoading(true)
    const { data } = await supabase
      .from('reminders')
      .select('*, customers(name)')
      .order('due_date', { ascending: true })
    setReminders(data || [])
    setLoading(false)
  }

  async function toggleComplete(reminder) {
    await supabase
      .from('reminders')
      .update({ completed: !reminder.completed })
      .eq('id', reminder.id)
    fetchReminders()
  }

  async function deleteReminder(id) {
    if (!confirm('Delete this reminder?')) return
    await supabase.from('reminders').delete().eq('id', id)
    fetchReminders()
  }

  const filtered = reminders
    .filter(r => {
      if (filter === 'pending') return !r.completed
      if (filter === 'done')    return r.completed
      return true
    })
    .sort((a, b) => STATUS_SORT[getStatus(a)] - STATUS_SORT[getStatus(b)])

  const overdueCount = reminders.filter(r => !r.completed && getStatus(r) === 'overdue').length

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-gray-900">Reminders</h2>
          {overdueCount > 0 && (
            <span className="bg-red-100 text-red-600 text-xs font-semibold px-2 py-0.5 rounded-full">
              {overdueCount} overdue
            </span>
          )}
        </div>
        <button
          onClick={() => { setEditingReminder(null); setShowForm(true) }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-700 transition"
        >
          + New Reminder
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {[['pending', 'Pending'], ['done', 'Done'], ['all', 'All']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setFilter(val)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition ${
              filter === val ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-gray-400 text-sm">No reminders found.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(reminder => {
            const status = getStatus(reminder)
            return (
              <div
                key={reminder.id}
                className={`bg-white border rounded-xl px-5 py-4 flex items-start gap-4 transition ${
                  reminder.completed ? 'border-gray-100 opacity-60' : 'border-gray-200'
                }`}
              >
                {/* Checkbox */}
                <button
                  onClick={() => toggleComplete(reminder)}
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition ${
                    reminder.completed
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-gray-500'
                  }`}
                >
                  {reminder.completed && (
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-medium text-sm ${reminder.completed ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                      {reminder.title}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_STYLES[reminder.type] || ''}`}>
                      {TYPE_LABELS[reminder.type]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[status]}`}>
                      {STATUS_LABELS[status]} · {reminder.due_date}
                    </span>
                    {reminder.customers?.name && (
                      <span>{reminder.customers.name}</span>
                    )}
                  </div>
                  {reminder.notes && (
                    <p className="text-xs text-gray-400 mt-1 truncate">{reminder.notes}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3 flex-shrink-0 text-sm">
                  <button
                    onClick={() => { setEditingReminder(reminder); setShowForm(true) }}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => deleteReminder(reminder.id)}
                    className="text-red-500 hover:text-red-700 font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showForm && (
        <ReminderForm
          reminder={editingReminder}
          onClose={() => { setShowForm(false); setEditingReminder(null) }}
          onSave={() => { setShowForm(false); setEditingReminder(null); fetchReminders() }}
        />
      )}
    </div>
  )
}
