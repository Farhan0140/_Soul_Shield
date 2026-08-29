package task

import (
	"soulsheld/repo"
	"strings"
	"time"
)

// isAlreadyAddedByUser - একটা fixed (is_global) task এর জন্য, user এর personal task
// রেফারেন্সগুলোর মধ্যে lineage (source_task_id) বা case-insensitive/trimmed title ম্যাচ
// খুঁজে বের করে - ListTasks এ প্রতিটা fixed task এ already_added ফ্ল্যাগ বসাতে ব্যবহার হয়
// (repo.taskRepo.FindOwnedMatch এর মতোই লজিক, কিন্তু bulk এ Go তে - প্রতি task এ query এড়াতে)
func isAlreadyAddedByUser(sourceTaskID int64, sourceTitle string, ownedRefs []repo.TaskRef) bool {
	normalizedTitle := strings.ToLower(strings.TrimSpace(sourceTitle))
	for _, ref := range ownedRefs {
		if ref.SourceTaskID.Valid && ref.SourceTaskID.Int64 == sourceTaskID {
			return true
		}
		if strings.ToLower(strings.TrimSpace(ref.Title)) == normalizedTitle {
			return true
		}
	}
	return false
}

// repo.Task -> TaskResponse (একটা task এর পূর্ণ তথ্য, Create/Update এর response এ ব্যবহার হয়)
// subTasks প্যারামিটার optional - দিলে response এ embed হবে (কোনো নির্দিষ্ট date এর status ছাড়াই)
func toTaskResponse(t *repo.Task, subTasks []repo.SubTask) TaskResponse {
	var ownerID *int64
	if t.OwnerID.Valid {
		id := t.OwnerID.Int64
		ownerID = &id
	}

	days := make([]int64, len(t.RecurrenceDays))
	copy(days, t.RecurrenceDays)

	resp := TaskResponse{
		ID:             t.ID,
		Title:          t.Title,
		Description:    t.Description.String,
		IsGlobal:       t.IsGlobal,
		OwnerID:        ownerID,
		RecurrenceType: t.RecurrenceType,
		RecurrenceDays: days,
		IsActive:       t.IsActive,
		CreatedBy:      t.CreatedBy,
		Position:       t.Position,
		CreatedAt:      t.CreatedAt,
		UpdatedAt:      t.UpdatedAt,
	}

	if len(subTasks) > 0 {
		resp.SubTasks = make([]SubTaskStatusResponse, len(subTasks))
		for i, s := range subTasks {
			resp.SubTasks[i] = toSubTaskResponse(s)
		}
	}

	return resp
}

// repo.SubTask -> SubTaskStatusResponse, কোনো date-scoped status ছাড়া (Create/Update এর response এ)
func toSubTaskResponse(s repo.SubTask) SubTaskStatusResponse {
	var targetCount *int32
	if s.TargetCount.Valid {
		v := s.TargetCount.Int32
		targetCount = &v
	}
	var durationSeconds *int32
	if s.DurationSeconds.Valid {
		v := s.DurationSeconds.Int32
		durationSeconds = &v
	}
	return SubTaskStatusResponse{
		SubTaskID:       s.ID,
		Title:           s.Title,
		TaskType:        s.TaskType,
		TargetCount:     targetCount,
		DurationSeconds: durationSeconds,
	}
}

// repo.SubTaskWithStatus -> SubTaskStatusResponse (List/History endpoint এর জন্য, নির্দিষ্ট date এর status সহ)
func toSubTaskWithStatusResponse(s repo.SubTaskWithStatus) SubTaskStatusResponse {
	return SubTaskStatusResponse{
		SubTaskID:       s.SubTaskID,
		Title:           s.Title,
		TaskType:        s.TaskType,
		TargetCount:     s.TargetCount,
		DurationSeconds: s.DurationSeconds,
		ProgressCount:   s.ProgressCount,
		Status:          s.Status,
		CompletedAt:     s.CompletedAt,
	}
}

// repo.SubTaskCompletion -> SubTaskCompletionResponse (Complete/Increment endpoint এর response)
func toSubTaskCompletionResponse(c *repo.SubTaskCompletion, parentStatus string, parentRewardText *string) SubTaskCompletionResponse {
	var completedAt *time.Time
	if c.CompletedAt.Valid {
		t := c.CompletedAt.Time
		completedAt = &t
	}

	return SubTaskCompletionResponse{
		ID:               c.ID,
		SubTaskID:        c.SubTaskID.Int64,
		ParentTaskID:     c.ParentTaskID,
		SubTaskTitle:     c.SubTaskTitleSnapshot,
		Date:             c.TaskDate.Format("2006-01-02"),
		Status:           c.Status,
		ProgressCount:    c.ProgressCount,
		CompletedAt:      completedAt,
		ParentStatus:     parentStatus,
		ParentRewardText: parentRewardText,
	}
}

// repo.TaskWithStatus -> TaskWithStatusResponse (List/History endpoint এর জন্য, প্রতিটা item এ status+category+counter তথ্য থাকে)
func toTaskWithStatusResponse(t repo.TaskWithStatus) TaskWithStatusResponse {
	resp := TaskWithStatusResponse{
		TaskID:         t.TaskID,
		Title:          t.Title,
		Description:    t.Description,
		IsGlobal:       t.IsGlobal,
		RecurrenceType: t.RecurrenceType,
		Date:           t.Date,
		Status:         t.Status,
		CompletedAt:    t.CompletedAt,

		CategoryID:    t.CategoryID,
		CategoryName:  t.CategoryName,
		CategoryColor: t.CategoryColor,

		RewardText: t.RewardText,

		TaskType:        t.TaskType,
		TargetCount:     t.TargetCount,
		DurationSeconds: t.DurationSeconds,
		ProgressCount:   t.ProgressCount,

		RecurrenceDays: t.RecurrenceDays,
		ReminderTime:   t.ReminderTime,

		Position: t.Position,
	}

	if len(t.SubTasks) > 0 {
		resp.SubTasks = make([]SubTaskStatusResponse, len(t.SubTasks))
		for i, s := range t.SubTasks {
			resp.SubTasks[i] = toSubTaskWithStatusResponse(s)
		}
	}

	return resp
}

// repo.TaskCompletion -> CompletionResponse (Complete/Increment endpoint এর response)
func toCompletionResponse(c *repo.TaskCompletion) CompletionResponse {
	var taskID *int64
	if c.TaskID.Valid {
		id := c.TaskID.Int64
		taskID = &id
	}

	var completedAt *time.Time
	if c.CompletedAt.Valid {
		t := c.CompletedAt.Time
		completedAt = &t
	}

	return CompletionResponse{
		ID:          c.ID,
		TaskID:      taskID,
		TaskTitle:   c.TaskTitleSnapshot,
		Date:        c.TaskDate.Format("2006-01-02"),
		Status:      c.Status,
		CompletedAt: completedAt,
		RewardText:  c.RewardText,
	}
}
