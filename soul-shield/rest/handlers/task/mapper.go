package task

import (
	"soulsheld/repo"
	"time"
)

func toTaskResponse(t *repo.Task) TaskResponse {
	var ownerID *int64
	if t.OwnerID.Valid {
		id := t.OwnerID.Int64
		ownerID = &id
	}

	days := make([]int64, len(t.RecurrenceDays))
	copy(days, t.RecurrenceDays)

	return TaskResponse{
		ID:             t.ID,
		Title:          t.Title,
		Description:    t.Description.String,
		IsGlobal:       t.IsGlobal,
		OwnerID:        ownerID,
		RecurrenceType: t.RecurrenceType,
		RecurrenceDays: days,
		IsActive:       t.IsActive,
		CreatedBy:      t.CreatedBy,
		CreatedAt:      t.CreatedAt,
		UpdatedAt:      t.UpdatedAt,
	}
}

func toTaskWithStatusResponse(t repo.TaskWithStatus) TaskWithStatusResponse {
	return TaskWithStatusResponse{
		TaskID:         t.TaskID,
		Title:          t.Title,
		Description:    t.Description,
		IsGlobal:       t.IsGlobal,
		RecurrenceType: t.RecurrenceType,
		Date:           t.Date,
		Status:         t.Status,
		CompletedAt:    t.CompletedAt,
	}
}

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
	}
}
