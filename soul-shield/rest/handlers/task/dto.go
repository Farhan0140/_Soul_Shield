package task

import "time"

// ---- Request DTOs ----

type CreateTaskRequest struct {
	Title          string  `json:"title" example:"Read Quran"`
	Description    string  `json:"description" example:"Read at least 1 page daily"`
	RecurrenceType string  `json:"recurrence_type" example:"custom" enums:"daily,weekly,custom"`
	RecurrenceDays []int64 `json:"recurrence_days" example:"1,3,5"`
	IsGlobal       bool    `json:"is_global" example:"false"`

	CategoryID      *int64  `json:"category_id,omitempty" example:"1"`
	RewardText      string  `json:"reward_text,omitempty" example:"Alhamdulillah! +1 for jannah"`
	TaskType        string  `json:"task_type,omitempty" example:"normal" enums:"normal,counter,timer"`
	TargetCount     *int32  `json:"target_count,omitempty" example:"100"`      // task_type=counter হলে required
	DurationSeconds *int32  `json:"duration_seconds,omitempty" example:"1500"` // task_type=timer হলে required
	ReminderTime    *string `json:"reminder_time,omitempty" example:"18:30"`   // optional, "HH:MM" 24-hour format

	// SubTasks দিলে parent task এর status এখন থেকে sub-task completion থেকে derive হবে
	// (pending/partially_completed/completed) - parent নিজে সরাসরি complete করা যাবে না।
	SubTasks []SubTaskInput `json:"sub_tasks,omitempty"`
}

type UpdateTaskRequest struct {
	Title           *string  `json:"title,omitempty"`
	Description     *string  `json:"description,omitempty"`
	RecurrenceType  *string  `json:"recurrence_type,omitempty" enums:"daily,weekly,custom"`
	RecurrenceDays  *[]int64 `json:"recurrence_days,omitempty"`
	IsActive        *bool    `json:"is_active,omitempty"`
	CategoryID      *int64   `json:"category_id,omitempty"` // 0 পাঠালে uncategorize হবে
	RewardText      *string  `json:"reward_text,omitempty"`
	TargetCount     *int32   `json:"target_count,omitempty"`
	DurationSeconds *int32   `json:"duration_seconds,omitempty"`
	ReminderTime    *string  `json:"reminder_time,omitempty"` // "HH:MM" 24-hour format, empty string clears it

	// SubTasks nil হলে touch করা হবে না; দিলে (even []) পুরো লিস্ট replace হবে -
	// existing id ম্যাচ করলে update, নতুন id ছাড়া entry হলে insert, বাদ পড়া entry delete।
	SubTasks *[]SubTaskInput `json:"sub_tasks,omitempty"`
}

// SubTaskInput - create/update task request এর ভেতরে sub-task এর তথ্য
type SubTaskInput struct {
	ID              *int64 `json:"id,omitempty" example:"5"` // update এ existing sub-task ম্যাচ করাতে; create এ omit করবেন
	Title           string `json:"title" example:"Read 1 page"`
	TaskType        string `json:"task_type,omitempty" example:"normal" enums:"normal,counter,timer"`
	TargetCount     *int32 `json:"target_count,omitempty" example:"10"`      // task_type=counter হলে required
	DurationSeconds *int32 `json:"duration_seconds,omitempty" example:"600"` // task_type=timer হলে required
}

type IncrementTaskRequest struct {
	Amount int32  `json:"amount" example:"10"` // batch amount, single-tap না
	Date   string `json:"date,omitempty" example:"2026-07-04"`
}

// type CreateTaskRequest struct {
// 	Title          string  `json:"title" example:"Read Quran"`
// 	Description    string  `json:"description" example:"Read at least 1 page daily"`
// 	RecurrenceType string  `json:"recurrence_type" example:"custom"` // daily | weekly | custom
// 	RecurrenceDays []int64 `json:"recurrence_days" example:"1,3,5"`  // 0=Sunday...6=Saturday, daily/weekly হলে optional
// 	// IsGlobal শুধু admin ব্যবহার করবে, user request এ ignore করা হবে (handler এ role check হবে)
// 	IsGlobal bool `json:"is_global" example:"false"`
// }

// type UpdateTaskRequest struct {
// 	Title          *string  `json:"title,omitempty" example:"Read Quran"`
// 	Description    *string  `json:"description,omitempty" example:"Read at least 2 pages daily"`
// 	RecurrenceType *string  `json:"recurrence_type,omitempty" example:"custom"`
// 	RecurrenceDays *[]int64 `json:"recurrence_days,omitempty" example:"1,3,5"`
// 	IsActive       *bool    `json:"is_active,omitempty" example:"true"`
// }

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

	SubTasks []SubTaskStatusResponse `json:"sub_tasks,omitempty"`
}

// SubTaskStatusResponse - sub-task এর তথ্য + (list/history endpoint এ) একটা নির্দিষ্ট দিনের status
type SubTaskStatusResponse struct {
	SubTaskID       int64      `json:"sub_task_id" example:"5"`
	Title           string     `json:"title" example:"Read 1 page"`
	TaskType        string     `json:"task_type" example:"normal"`
	TargetCount     *int32     `json:"target_count,omitempty" example:"10"`
	DurationSeconds *int32     `json:"duration_seconds,omitempty" example:"600"`
	ProgressCount   int32      `json:"progress_count"`
	Status          string     `json:"status,omitempty" example:"pending"`
	CompletedAt     *time.Time `json:"completed_at,omitempty"`
}

type TaskWithStatusResponse struct {
	TaskID         int64      `json:"task_id"`
	Title          string     `json:"title"`
	Description    string     `json:"description"`
	IsGlobal       bool       `json:"is_global"`
	RecurrenceType string     `json:"recurrence_type"`
	Date           string     `json:"date"`
	Status         string     `json:"status"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`

	CategoryID    *int64  `json:"category_id,omitempty"`
	CategoryName  *string `json:"category_name,omitempty"`
	CategoryColor *string `json:"category_color,omitempty"`

	RewardText *string `json:"reward_text,omitempty"`

	TaskType        string `json:"task_type"`
	TargetCount     *int32 `json:"target_count,omitempty"`
	DurationSeconds *int32 `json:"duration_seconds,omitempty"`
	ProgressCount   int32  `json:"progress_count"`

	RecurrenceDays []int64 `json:"recurrence_days,omitempty"`
	ReminderTime   *string `json:"reminder_time,omitempty"`

	SubTasks []SubTaskStatusResponse `json:"sub_tasks,omitempty"`
}

// type TaskWithStatusResponse struct {
// 	TaskID         int64      `json:"task_id" example:"1"`
// 	Title          string     `json:"title" example:"Read Quran"`
// 	Description    string     `json:"description" example:"Read at least 1 page daily"`
// 	IsGlobal       bool       `json:"is_global" example:"false"`
// 	RecurrenceType string     `json:"recurrence_type" example:"custom"`
// 	Date           string     `json:"date" example:"2026-07-04"`
// 	Status         string     `json:"status" example:"pending"` // pending | completed | missed
// 	CompletedAt    *time.Time `json:"completed_at,omitempty"`
// }

type CompletionResponse struct {
	ID          int64      `json:"id" example:"10"`
	TaskID      *int64     `json:"task_id,omitempty" example:"1"`
	TaskTitle   string     `json:"task_title" example:"Read Quran"`
	Date        string     `json:"date" example:"2026-07-04"`
	Status      string     `json:"status" example:"completed"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	RewardText  *string    `json:"reward_text,omitempty" example:"Alhamdulillah! +1 for jannah"`
}

// SubTaskCompletionResponse - sub-task complete/increment endpoint এর response;
// ParentStatus/ParentRewardText দিয়ে client বুঝবে parent এর aggregate status
// এই action এর ফলে বদলালো কিনা (এবং সব sub-task শেষ হলে reward modal দেখাবে কিনা)।
type SubTaskCompletionResponse struct {
	ID            int64      `json:"id" example:"10"`
	SubTaskID     int64      `json:"sub_task_id" example:"5"`
	ParentTaskID  int64      `json:"parent_task_id" example:"1"`
	SubTaskTitle  string     `json:"sub_task_title" example:"Read 1 page"`
	Date          string     `json:"date" example:"2026-07-04"`
	Status        string     `json:"status" example:"completed"`
	ProgressCount int32      `json:"progress_count"`
	CompletedAt   *time.Time `json:"completed_at,omitempty"`

	ParentStatus     string  `json:"parent_status" example:"partially_completed"`
	ParentRewardText *string `json:"parent_reward_text,omitempty"`
}

// PaginatedTasksResponse - category detail page-এর জন্য paginated task list + page metadata।
// Tasks এ active task গুলো আগে, completed task গুলো পরে (sorted, বাদ দেওয়া হয় না) - TotalItems/
// TotalPages পুরো (active + completed) লিস্ট ধরে হিসাব হয়। CompletedItems শুধু কতগুলো completed
// তার count, client এ "N total, M completed" সামারি দেখাতে ব্যবহার হয়।
type PaginatedTasksResponse struct {
	Tasks          []TaskWithStatusResponse `json:"tasks"`
	Page           int                      `json:"page" example:"1"`
	PageSize       int                      `json:"page_size" example:"10"`
	TotalItems     int                      `json:"total_items" example:"23"`
	CompletedItems int                      `json:"completed_items" example:"5"`
	TotalPages     int                      `json:"total_pages" example:"3"`
}

type SuccessResponse struct {
	Message string `json:"message" example:"Task created successfully"`
}

type ErrorResponse struct {
	Error string `json:"error" example:"invalid request"`
}
