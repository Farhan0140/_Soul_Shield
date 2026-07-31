import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Loader2, Plus } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Input from './ui/Input';
import Button from './ui/Button';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const emptySubTask = () => ({ title: '', task_type: 'normal', target_count: 10 });

export default function TaskFormModal({ open, onClose, task, categories, onSaved, forceGlobal = false }) {
  const { isAdmin } = useAuth();
  const { createTask, updateTask } = useApi();
  const toast = useToast();
  const isEdit = !!task;

  const [form, setForm] = useState({
    title: '',
    description: '',
    category_id: '',
    recurrence_type: 'daily',
    recurrence_days: [0, 1, 2, 3, 4, 5, 6],
    task_type: 'normal',
    target_count: 100,
    reward_text: '',
    is_global: forceGlobal ? true : false,
  });
  const [subTasksEnabled, setSubTasksEnabled] = useState(false);
  const [subTasks, setSubTasks] = useState([emptySubTask()]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (task) {
        setForm({
          title: task.title || '',
          description: task.description || '',
          category_id: task.category_id || '',
          recurrence_type: task.recurrence_type || 'daily',
          recurrence_days: task.recurrence_days || [0,1,2,3,4,5,6],
          task_type: task.task_type || 'normal',
          target_count: task.target_count || 100,
          reward_text: task.reward_text || '',
          is_global: !!task.is_global,
        });
        const existingSubTasks = task.sub_tasks || [];
        setSubTasksEnabled(existingSubTasks.length > 0);
        setSubTasks(
          existingSubTasks.length > 0
            ? existingSubTasks.map((s) => ({
                id: s.sub_task_id,
                title: s.title,
                task_type: s.task_type,
                target_count: s.target_count || 10,
              }))
            : [emptySubTask()]
        );
      } else {
        setForm({
          title: '', description: '', category_id: '',
          recurrence_type: 'daily', recurrence_days: [0,1,2,3,4,5,6],
          task_type: 'normal', target_count: 100, reward_text: '', is_global: false,
        });
        setSubTasksEnabled(false);
        setSubTasks([emptySubTask()]);
      }
      setErrors({});
    }
  }, [open, task]);

  const updateSubTask = (index, patch) => {
    setSubTasks((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removeSubTask = (index) => {
    setSubTasks((rows) => rows.filter((_, i) => i !== index));
  };

  const addSubTask = () => {
    setSubTasks((rows) => [...rows, emptySubTask()]);
  };

  const toggleDay = (d) => {
    setForm(f => {
      const has = f.recurrence_days.includes(d);
      const next = has ? f.recurrence_days.filter(x => x !== d) : [...f.recurrence_days, d];
      return { ...f, recurrence_days: next };
    });
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = "What's this task called?";
    if (form.task_type === 'counter' && (!form.target_count || form.target_count < 1))
      e.target_count = "How many times should it be done?";
    if (subTasksEnabled) {
      const hasInvalidSubTask = subTasks.length === 0 || subTasks.some((s) =>
        !s.title.trim() || (s.task_type === 'counter' && (!s.target_count || s.target_count < 1))
      );
      if (hasInvalidSubTask) e.sub_tasks = 'Give every sub-task a title (and a target count if it\'s a Counter).';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setLoading(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      category_id: form.category_id ? Number(form.category_id) : undefined,
      recurrence_type: form.recurrence_type,
      recurrence_days: form.recurrence_type === 'daily' ? [0,1,2,3,4,5,6] : form.recurrence_days,
      task_type: form.task_type,
      reward_text: form.reward_text.trim() || undefined,
      is_global: isAdmin ? form.is_global : false,
    };
    if (form.task_type === 'counter') payload.target_count = Number(form.target_count);

    if (subTasksEnabled) {
      payload.sub_tasks = subTasks.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        title: s.title.trim(),
        task_type: s.task_type,
        target_count: s.task_type === 'counter' ? Number(s.target_count) : undefined,
      }));
    } else if (isEdit && (task.sub_tasks || []).length > 0) {
      // Sub-tasks were turned off on an existing task that had them — send an
      // empty list so the backend actually clears them (undefined would leave
      // the existing list untouched, per PATCH /tasks/{id}'s sub_tasks semantics).
      payload.sub_tasks = [];
    }

    try {
      let saved;
      if (isEdit) {
        saved = await updateTask(task.task_id, payload);
        toast.success('Task updated ✨');
      } else {
        saved = await createTask(payload);
        toast.success('Task created 🎉');
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <m.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          onClick={onClose}
        >
          <m.div
            initial={{ scale: 0.95, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-800">
                {isEdit ? 'Edit task' : 'New task'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <Input
                label="Title"
                value={form.title}
                error={errors.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />

              <div className="relative">
                <label htmlFor="task-description" className="text-xs font-semibold text-slate-600 mb-1.5 block">
                  Description
                </label>
                <textarea
                  id="task-description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional — add any extra detail"
                  className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none text-sm resize-none transition-colors"
                />
              </div>

              {/* Category */}
              <div>
                <label htmlFor="task-category" className="text-xs font-semibold text-slate-600 mb-1.5 block">Category</label>
                <select
                  id="task-category"
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full px-3 py-3 rounded-xl border-2 border-slate-200 focus:border-indigo-500 outline-none text-sm bg-white"
                >
                  <option value="">No category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Recurrence type */}
              <div>
                <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Recurrence</span>
                <div className="grid grid-cols-3 gap-2">
                  {['daily', 'weekly', 'custom'].map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setForm({ ...form, recurrence_type: type })}
                      className={`py-2 rounded-xl text-sm font-medium border-2 transition-all capitalize
                        ${form.recurrence_type === type
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              {/* Day picker (weekly/custom only) */}
              {form.recurrence_type !== 'daily' && (
                <div>
                  <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Days</span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {DAYS.map((d, i) => {
                      const active = form.recurrence_days.includes(i);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggleDay(i)}
                          className={`py-2 rounded-lg text-xs font-semibold transition-all
                            ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Task type toggle */}
              <div>
                <span className="text-xs font-semibold text-slate-600 mb-1.5 block">Task type</span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, task_type: 'normal' })}
                    className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all
                      ${form.task_type === 'normal' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    ✓ Normal
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, task_type: 'counter' })}
                    className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all
                      ${form.task_type === 'counter' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600'}`}
                  >
                    🔢 Counter
                  </button>
                </div>
              </div>

              {/* Target count (counter only) */}
              {form.task_type === 'counter' && (
                <Input
                  label="Target count"
                  type="number"
                  value={form.target_count}
                  error={errors.target_count}
                  onChange={(e) => setForm({ ...form, target_count: e.target.value })}
                />
              )}

              {/* Sub-tasks */}
              <div>
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subTasksEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setSubTasksEnabled(enabled);
                      if (enabled && subTasks.length === 0) setSubTasks([emptySubTask()]);
                    }}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-700">Do you want to add sub-tasks?</p>
                    <p className="text-xs text-slate-500">
                      Break this task into smaller Normal or Counter sub-tasks.
                    </p>
                  </div>
                </label>

                {subTasksEnabled && (
                  <div className="mt-3 space-y-3">
                    {subTasks.map((s, i) => (
                      <div key={i} className="p-3 rounded-xl border border-slate-200 space-y-2">
                        <div className="flex items-end gap-2">
                          <div className="flex-1">
                            <Input
                              label={`Sub-task ${i + 1}`}
                              value={s.title}
                              onChange={(e) => updateSubTask(i, { title: e.target.value })}
                              placeholder="e.g. Read 1 page"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSubTask(i)}
                            aria-label="Remove sub-task"
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => updateSubTask(i, { task_type: 'normal' })}
                            className={`py-2 rounded-lg text-xs font-medium border-2 transition-all
                              ${s.task_type === 'normal' ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}
                          >
                            Normal
                          </button>
                          <button
                            type="button"
                            onClick={() => updateSubTask(i, { task_type: 'counter' })}
                            className={`py-2 rounded-lg text-xs font-medium border-2 transition-all
                              ${s.task_type === 'counter' ? 'border-purple-500 bg-purple-50 text-purple-700' : 'border-slate-200 text-slate-600'}`}
                          >
                            Counter
                          </button>
                        </div>
                        {s.task_type === 'counter' && (
                          <Input
                            label="Target count"
                            type="number"
                            value={s.target_count}
                            onChange={(e) => updateSubTask(i, { target_count: e.target.value })}
                          />
                        )}
                      </div>
                    ))}
                    {errors.sub_tasks && (
                      <p className="text-xs text-rose-600">{errors.sub_tasks}</p>
                    )}
                    <button
                      type="button"
                      onClick={addSubTask}
                      className="w-full py-2 rounded-xl text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors flex items-center justify-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add More Sub-Tasks
                    </button>
                  </div>
                )}
              </div>

              <Input
                label="Reward message (shown on completion)"
                value={form.reward_text}
                onChange={(e) => setForm({ ...form, reward_text: e.target.value })}
              />

              {/* Admin: global toggle */}
              {isAdmin && (
                <label className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer
                  ${forceGlobal
                    ? 'bg-amber-100 border-amber-300'
                    : 'bg-amber-50 border-amber-200'}`}
                >
                  <input
                    type="checkbox"
                    checked={form.is_global}
                    onChange={(e) => setForm({ ...form, is_global: e.target.checked })}
                    disabled={forceGlobal}
                    className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      {forceGlobal ? 'Fixed Task (required)' : 'Make this a Fixed Task'}
                    </p>
                    <p className="text-xs text-amber-700">
                      {forceGlobal
                        ? 'Admin panel tasks are always visible to every user.'
                        : 'Visible to every user — admin-managed'}
                    </p>
                  </div>
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" loading={loading} className="flex-1">
                  {isEdit ? 'Save changes' : 'Create task'}
                </Button>
              </div>
            </form>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>
  );
}