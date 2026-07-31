package task

import (
	"soulsheld/repo"
	"soulsheld/util"
	"time"
)

// computeParentStatus - sub-task গুলোর completion থেকে parent task এর aggregate status বের করে।
// কোনো sub-task complete না হলে pending (বা past date হলে missed), সব complete হলে completed,
// আংশিক complete হলে partially_completed।
func computeParentStatus(subs []repo.SubTaskWithStatus, dateStr, today string) string {
	completed := 0
	for _, s := range subs {
		if s.Status == util.StatusCompleted {
			completed++
		}
	}
	switch {
	case completed == len(subs):
		return util.StatusCompleted
	case completed > 0:
		return util.StatusPartiallyCompleted
	case dateStr < today:
		return util.StatusMissed
	default:
		return util.StatusPending
	}
}

// attachSubTasksForDate - একটা নির্দিষ্ট দিনের task list এ sub-task status merge করে এবং
// sub-task থাকা task গুলোর Status/RewardText পুনরায় গণনা করে (parent নিজে সরাসরি complete
// করা যায় না, status সবসময় sub-task completion থেকে derive হয়)।
func (h *Handler) attachSubTasksForDate(tasks []repo.TaskWithStatus, userID int64, date time.Time) error {
	if len(tasks) == 0 {
		return nil
	}
	ids := make([]int64, len(tasks))
	for i, t := range tasks {
		ids[i] = t.TaskID
	}

	subsByParent, err := h.subTaskRepo.ListWithStatusForDate(userID, ids, date)
	if err != nil {
		return err
	}

	dateStr := date.Format("2006-01-02")
	today := time.Now().Format("2006-01-02")

	for i := range tasks {
		subs := subsByParent[tasks[i].TaskID]
		if len(subs) == 0 {
			continue
		}
		tasks[i].SubTasks = subs
		tasks[i].Status = computeParentStatus(subs, dateStr, today)
		tasks[i].RewardText = nil
		if tasks[i].Status == util.StatusCompleted {
			if parent, err := h.taskRepo.GetByID(tasks[i].TaskID); err == nil && parent.RewardText.Valid {
				rt := parent.RewardText.String
				tasks[i].RewardText = &rt
			}
		}
	}

	return nil
}

// attachSubTasksForRange - history endpoint এর জন্য, একাধিক দিনের task list এ sub-task status merge করে।
func (h *Handler) attachSubTasksForRange(tasks []repo.TaskWithStatus, userID int64, from, to time.Time) error {
	if len(tasks) == 0 {
		return nil
	}

	idSet := make(map[int64]bool)
	for _, t := range tasks {
		idSet[t.TaskID] = true
	}
	ids := make([]int64, 0, len(idSet))
	for id := range idSet {
		ids = append(ids, id)
	}

	subsByDateParent, err := h.subTaskRepo.ListWithStatusForRange(userID, ids, from, to)
	if err != nil {
		return err
	}

	today := time.Now().Format("2006-01-02")
	rewardCache := make(map[int64]*string)

	for i := range tasks {
		subs := subsByDateParent[tasks[i].Date][tasks[i].TaskID]
		if len(subs) == 0 {
			continue
		}
		tasks[i].SubTasks = subs
		tasks[i].Status = computeParentStatus(subs, tasks[i].Date, today)
		tasks[i].RewardText = nil
		if tasks[i].Status == util.StatusCompleted {
			rt, cached := rewardCache[tasks[i].TaskID]
			if !cached {
				if parent, err := h.taskRepo.GetByID(tasks[i].TaskID); err == nil && parent.RewardText.Valid {
					v := parent.RewardText.String
					rt = &v
				}
				rewardCache[tasks[i].TaskID] = rt
			}
			tasks[i].RewardText = rt
		}
	}

	return nil
}
