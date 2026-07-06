package task

import "time"

// ---- Request DTOs ----

type CreateTaskRequest struct {
	Title          string  `json:"title" example:"Read Quran"`
	Description    string  `json:"description" example:"Read at least 1 page daily"`
	RecurrenceType string  `json:"recurrence_type" example:"custom"` // daily | weekly | custom
	RecurrenceDays []int64 `json:"recurrence_days" example:"1,3,5"`  // 0=Sunday...6=Saturday, daily/weekly হলে optional
	// IsGlobal শুধু admin ব্যবহার করবে, user request এ ignore করা হবে (handler এ role check হবে)
	IsGlobal bool `json:"is_global" example:"false"`
}

type UpdateTaskRequest struct {
	Title          *string  `json:"title,omitempty" example:"Read Quran"`
	Description    *string  `json:"description,omitempty" example:"Read at least 2 pages daily"`
	RecurrenceType *string  `json:"recurrence_type,omitempty" example:"custom"`
	RecurrenceDays *[]int64 `json:"recurrence_days,omitempty" example:"1,3,5"`
	IsActive       *bool    `json:"is_active,omitempty" example:"true"`
}

type CompleteTaskRequest struct {
	// না দিলে আজকের তারিখ ধরা হবে; format: YYYY-MM-DD
	Date string `json:"date,omitempty" example:"2026-07-04"`
}

// ---- Response DTOs ----

type TaskResponse struct {
	ID             int64     `json:"id" example:"1"`
	Title          string    `json:"title" example:"Read Quran"`
	Description    string    `json:"description" example:"Read at least 1 page daily"`
	IsGlobal       bool      `json:"is_global" example:"false"`
	OwnerID        *int64    `json:"owner_id,omitempty" example:"3"`
	RecurrenceType string    `json:"recurrence_type" example:"custom"`
	RecurrenceDays []int64   `json:"recurrence_days" example:"1,3,5"`
	IsActive       bool      `json:"is_active" example:"true"`
	CreatedBy      int64     `json:"created_by" example:"1"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type TaskWithStatusResponse struct {
	TaskID         int64      `json:"task_id" example:"1"`
	Title          string     `json:"title" example:"Read Quran"`
	Description    string     `json:"description" example:"Read at least 1 page daily"`
	IsGlobal       bool       `json:"is_global" example:"false"`
	RecurrenceType string     `json:"recurrence_type" example:"custom"`
	Date           string     `json:"date" example:"2026-07-04"`
	Status         string     `json:"status" example:"pending"` // pending | completed | missed
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
}

type CompletionResponse struct {
	ID          int64      `json:"id" example:"10"`
	TaskID      *int64     `json:"task_id,omitempty" example:"1"`
	TaskTitle   string     `json:"task_title" example:"Read Quran"`
	Date        string     `json:"date" example:"2026-07-04"`
	Status      string     `json:"status" example:"completed"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
}

type SuccessResponse struct {
	Message string `json:"message" example:"Task created successfully"`
}

type ErrorResponse struct {
	Error string `json:"error" example:"invalid request"`
}
