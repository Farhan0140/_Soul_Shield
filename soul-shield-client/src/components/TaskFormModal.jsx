import { useState, useEffect } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import { X, Plus, ListChecks, Hash, Timer, Shield } from 'lucide-react';
import { useApi } from '../context/ApiContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from './Toast';
import Input from './ui/Input';
import Textarea from './ui/Textarea';
import Select from './ui/Select';
import Checkbox from './ui/Checkbox';
import SegmentedControl from './ui/SegmentedControl';
import Modal, { ModalBody, ModalFooter } from './ui/Modal';
import { FieldMessage } from './ui/Field';
import Button from './ui/Button';
import { cn } from '../utils/cn';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const RECURRENCE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom' },
];

const TYPE_OPTIONS = [
  { value: 'normal', label: 'Normal', icon: ListChecks },
  { value: 'counter', label: 'Counter', icon: Hash },
  { value: 'timer', label: 'Timer', icon: Timer },
];

/** Labelled group for controls that aren't a single input (segmented
 * pickers, day chips). */
function FormGroup({ label, children }) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-1.5 text-[13px] font-medium text-fg-2">{label}</p>
      {children}
    </div>
  );
}

const emptySubTask = () => ({ title: '', description: '', task_type: 'normal', target_count: 10, duration_hours: 0, duration_minutes: 5 });

function durationSeconds(hours, minutes) {
  return (Number(hours) || 0) * 3600 + (Number(minutes) || 0) * 60;
}

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
    duration_hours: 0,
    duration_minutes: 30,
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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form when the modal opens
        setForm({
          title: task.title || '',
          description: task.description || '',
          category_id: task.category_id || '',
          recurrence_type: task.recurrence_type || 'daily',
          recurrence_days: task.recurrence_days || [0,1,2,3,4,5,6],
          task_type: task.task_type || 'normal',
          target_count: task.target_count || 100,
          duration_hours: task.duration_seconds ? Math.floor(task.duration_seconds / 3600) : 0,
          duration_minutes: task.duration_seconds ? Math.floor((task.duration_seconds % 3600) / 60) : 30,
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
                description: s.description || '',
                task_type: s.task_type,
                target_count: s.target_count || 10,
                duration_hours: s.duration_seconds ? Math.floor(s.duration_seconds / 3600) : 0,
                duration_minutes: s.duration_seconds ? Math.floor((s.duration_seconds % 3600) / 60) : 5,
              }))
            : [emptySubTask()]
        );
      } else {
        setForm({
          title: '', description: '', category_id: '',
          recurrence_type: 'daily', recurrence_days: [0,1,2,3,4,5,6],
          task_type: 'normal', target_count: 100, duration_hours: 0, duration_minutes: 30,
          reward_text: '', is_global: false,
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

  // Sub-tasks only make sense under a Normal parent — a Counter/Timer
  // parent's own progress/duration become meaningless once completion is
  // derived from children (Counter) or is intrinsic to a single countdown
  // (Timer), so switching away from Normal drops any sub-tasks rather than
  // leaving a hidden, no-longer-editable list attached to the task.
  const handleNonNormalType = (taskType) => {
    setForm({ ...form, task_type: taskType });
    setSubTasksEnabled(false);
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
    if (form.task_type === 'timer' && durationSeconds(form.duration_hours, form.duration_minutes) < 1)
      e.duration = 'How long should the timer run for?';
    if (subTasksEnabled) {
      const hasInvalidSubTask = subTasks.length === 0 || subTasks.some((s) => {
        if (!s.title.trim()) return true;
        if (s.task_type === 'counter' && (!s.target_count || s.target_count < 1)) return true;
        if (s.task_type === 'timer' && durationSeconds(s.duration_hours, s.duration_minutes) < 1) return true;
        return false;
      });
      if (hasInvalidSubTask) e.sub_tasks = 'Give every sub-task a title (and a target count/duration for Counter/Timer types).';
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
    if (form.task_type === 'timer') payload.duration_seconds = durationSeconds(form.duration_hours, form.duration_minutes);

    if (subTasksEnabled) {
      payload.sub_tasks = subTasks.map((s) => ({
        ...(s.id ? { id: s.id } : {}),
        title: s.title.trim(),
        // ALWAYS sent (null included): the backend assigns description in full
        // on sub-task update, so an emptied field clears the stored one —
        // same semantics as the mobile form. Optional, no validation.
        description: s.description.trim() || null,
        task_type: s.task_type,
        target_count: s.task_type === 'counter' ? Number(s.target_count) : undefined,
        duration_seconds: s.task_type === 'timer' ? durationSeconds(s.duration_hours, s.duration_minutes) : undefined,
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
        toast.success('Task updated');
      } else {
        saved = await createTask(payload);
        toast.success('Task created');
      }
      onSaved(saved);
      onClose();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  // A save in flight can't be abandoned halfway by closing the dialog.
  const handleClose = () => {
    if (!loading) onClose();
  };

  const handleTypeChange = (taskType) => {
    if (taskType === 'normal') setForm({ ...form, task_type: 'normal' });
    else handleNonNormalType(taskType);
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={isEdit ? 'Edit task' : forceGlobal ? 'New fixed task' : 'New task'}
      description={isEdit ? 'Update the details, schedule or tracking for this task.' : 'Set what to do, how often, and how to track it.'}
      size="lg"
    >
      <form onSubmit={handleSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
        <ModalBody className="space-y-5">
          <Input
            label="Title"
            value={form.title}
            error={errors.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="e.g. Read 10 pages"
            required
          />

          <Textarea
            label="Description"
            optional
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Add any extra detail"
          />

          <Select
            label="Category"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">No category</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>

          <FormGroup label="Repeats">
            <SegmentedControl
              fullWidth
              ariaLabel="Repeats"
              options={RECURRENCE_OPTIONS}
              value={form.recurrence_type}
              onChange={(type) => setForm({ ...form, recurrence_type: type })}
            />
          </FormGroup>

          {/* Day picker (weekly/custom only) */}
          {form.recurrence_type !== 'daily' && (
            <FormGroup label="On these days">
              <div className="grid grid-cols-7 gap-1.5">
                {DAYS.map((d, i) => {
                  const active = form.recurrence_days.includes(i);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleDay(i)}
                      aria-pressed={active}
                      aria-label={DAY_NAMES[i]}
                      className={cn(
                        'h-9 rounded-lg border text-xs font-medium transition-[background-color,border-color,color,transform] active:scale-95',
                        active
                          ? 'border-[color-mix(in_srgb,var(--on-primary)_15%,var(--primary))] bg-primary text-on-primary shadow-[inset_0_1px_0_var(--edge-top),inset_0_-2px_0_var(--edge-bottom)]'
                          : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg'
                      )}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </FormGroup>
          )}

          <FormGroup label="Task type">
            <SegmentedControl
              fullWidth
              ariaLabel="Task type"
              options={TYPE_OPTIONS}
              value={form.task_type}
              onChange={handleTypeChange}
            />
          </FormGroup>

          {/* Target count (counter only) */}
          {form.task_type === 'counter' && (
            <Input
              label="Target count"
              type="number"
              inputMode="numeric"
              min="1"
              value={form.target_count}
              error={errors.target_count}
              onChange={(e) => setForm({ ...form, target_count: e.target.value })}
            />
          )}

          {/* Duration (timer only) */}
          {form.task_type === 'timer' && (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Hours"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="23"
                  value={form.duration_hours}
                  onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}
                />
                <Input
                  label="Minutes"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  max="59"
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                />
              </div>
              <FieldMessage error={errors.duration} />
            </div>
          )}

          {/* Sub-tasks — Normal task type only, see handleNonNormalType's doc comment */}
          {form.task_type === 'normal' && (
            <div className="space-y-3">
              <Checkbox
                card
                checked={subTasksEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  setSubTasksEnabled(enabled);
                  if (enabled && subTasks.length === 0) setSubTasks([emptySubTask()]);
                }}
                label="Split into sub-tasks"
                description="Break this task into smaller Normal, Counter, or Timer steps."
              />

              <AnimatePresence initial={false}>
                {subTasksEnabled && (
                  <m.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3">
                      {subTasks.map((s, i) => (
                        <div key={i} className="space-y-3 rounded-xl border border-border bg-surface-2 p-3.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium tabular-nums text-muted">Sub-task {i + 1}</span>
                            <button
                              type="button"
                              onClick={() => removeSubTask(i)}
                              aria-label={`Remove sub-task ${i + 1}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                          <Input
                            label="Title"
                            size="md"
                            value={s.title}
                            onChange={(e) => updateSubTask(i, { title: e.target.value })}
                            placeholder="e.g. Read 1 page"
                          />
                          <Textarea
                            label="Description"
                            optional
                            rows={2}
                            value={s.description}
                            onChange={(e) => updateSubTask(i, { description: e.target.value })}
                            placeholder="Optional details"
                          />
                          <SegmentedControl
                            fullWidth
                            size="sm"
                            ariaLabel={`Sub-task ${i + 1} type`}
                            options={TYPE_OPTIONS}
                            value={s.task_type}
                            onChange={(type) => updateSubTask(i, { task_type: type })}
                          />
                          {s.task_type === 'counter' && (
                            <Input
                              label="Target count"
                              size="md"
                              type="number"
                              inputMode="numeric"
                              min="1"
                              value={s.target_count}
                              onChange={(e) => updateSubTask(i, { target_count: e.target.value })}
                            />
                          )}
                          {s.task_type === 'timer' && (
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                label="Hours"
                                size="md"
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="23"
                                value={s.duration_hours}
                                onChange={(e) => updateSubTask(i, { duration_hours: e.target.value })}
                              />
                              <Input
                                label="Minutes"
                                size="md"
                                type="number"
                                inputMode="numeric"
                                min="0"
                                max="59"
                                value={s.duration_minutes}
                                onChange={(e) => updateSubTask(i, { duration_minutes: e.target.value })}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      <FieldMessage error={errors.sub_tasks} />
                      <Button variant="secondary" fullWidth onClick={addSubTask}>
                        <Plus className="h-4 w-4" /> Add another sub-task
                      </Button>
                    </div>
                  </m.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <Input
            label="Reward message"
            optional
            hint="Shown when the task is completed."
            value={form.reward_text}
            onChange={(e) => setForm({ ...form, reward_text: e.target.value })}
            placeholder="e.g. Well done — keep it up!"
          />

          {/* Admin: global toggle */}
          {isAdmin && (
            <Checkbox
              card
              tone="warning"
              checked={form.is_global}
              onChange={(e) => setForm({ ...form, is_global: e.target.checked })}
              disabled={forceGlobal}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                  {forceGlobal ? 'Fixed task (required)' : 'Make this a fixed task'}
                </span>
              }
              description={
                forceGlobal
                  ? 'Admin panel tasks are always visible to every user.'
                  : 'Visible to every user — admin-managed.'
              }
            />
          )}
        </ModalBody>

        <ModalFooter>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            {isEdit ? 'Save changes' : 'Create task'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
