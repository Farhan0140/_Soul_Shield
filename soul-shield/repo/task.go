package repo

import (
	"time"

	"github.com/jmoiron/sqlx"
)

type Task struct {
	ID          int `json:"" db:""`
	UserID      int `json:"" db:""`
	Title       string `json:"" db:""`
	Description string `json:"" db:""`
	Priority    string `json:"" db:""`
	Status      string `json:"" db:""`
	DueDate     time.Time `json:"" db:""`
}

type TaskRepo interface {
	Create(task Task) (*Task, error)
	GetAll(userID int) ([]Task, error)
	GetByID(id int, userID int) (*Task, error)
	Update(task Task) error
	Delete(id int, userID int) error
	Complete(id int, userID int) error
}

type taskRepo struct {
	db *sqlx.DB
}

func NewTaskRepo(db *sqlx.DB) TaskRepo {
	return &taskRepo{
		db: db,
	}
}

func (r *taskRepo) Create(task Task) (*Task, error) {
	return nil, nil
}
func (r *taskRepo) GetAll(userID int) ([]Task, error) {
	return nil, nil
	
}
func (r *taskRepo) GetByID(id int, userID int) (*Task, error) {
	return nil, nil
	
}
func (r *taskRepo) Update(task Task) error {
	return nil
}

func (r *taskRepo) Delete(id int, userID int) error {
	return nil
	
}
func (r *taskRepo) Complete(id int, userID int) error {
	return nil
}