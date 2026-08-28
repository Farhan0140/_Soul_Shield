package repo

import (
	"database/sql"
	"errors"
	"soulsheld/util"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

type Category struct {
	ID        int64     `db:"id" json:"id"`
	Name      string    `db:"name" json:"name"`
	ColorHex  string    `db:"color_hex" json:"color_hex"`
	OwnerID   int64     `db:"owner_id" json:"owner_id"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
	UpdatedAt time.Time `db:"updated_at" json:"updated_at"`
}

type CategoryUpdate struct {
	Name     *string
	ColorHex *string
}

type CategoryRepo interface {
	Create(cat Category) (*Category, error)
	ListByOwner(ownerID int64) ([]Category, error)
	Update(id int64, updates CategoryUpdate, ownerID int64) (*Category, error)
	Delete(id int64, ownerID int64) error
	GetByID(id int64) (*Category, error)
	FindByOwnerAndNameCI(ownerID int64, name string) (*Category, error)
}

type categoryRepo struct {
	db *sqlx.DB
}

func NewCategoryRepo(db *sqlx.DB) CategoryRepo {
	return &categoryRepo{db: db}
}

func (r *categoryRepo) Create(cat Category) (*Category, error) {
	query := `
		INSERT INTO categories (name, color_hex, owner_id)
		VALUES ($1, $2, $3)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(query, cat.Name, cat.ColorHex, cat.OwnerID).
		Scan(&cat.ID, &cat.CreatedAt, &cat.UpdatedAt)

	if err != nil {
		if pqErr, ok := err.(*pq.Error); ok && pqErr.Code == "23505" {
			return nil, util.ErrCategoryExists
		}
		return nil, err
	}

	return &cat, nil
}

func (r *categoryRepo) ListByOwner(ownerID int64) ([]Category, error) {
	var categories []Category
	err := r.db.Select(&categories, `
		SELECT * FROM categories WHERE owner_id = $1 ORDER BY created_at
	`, ownerID)
	return categories, err
}

func (r *categoryRepo) GetByID(id int64) (*Category, error) {
	var cat Category
	err := r.db.Get(&cat, `SELECT * FROM categories WHERE id = $1`, id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, util.ErrCategoryNotFound
		}
		return nil, err
	}
	return &cat, nil
}

// FindByOwnerAndNameCI - case-insensitive নামে owner এর category খুঁজে বের করে
// (admin task থেকে "Add to Your Own Tasks" করার সময় category reuse করতে ব্যবহার হয়)
func (r *categoryRepo) FindByOwnerAndNameCI(ownerID int64, name string) (*Category, error) {
	var cat Category
	err := r.db.Get(&cat, `
		SELECT * FROM categories WHERE owner_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1
	`, ownerID, name)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, util.ErrCategoryNotFound
		}
		return nil, err
	}
	return &cat, nil
}

func (r *categoryRepo) Update(id int64, updates CategoryUpdate, ownerID int64) (*Category, error) {
	existing, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	if existing.OwnerID != ownerID {
		return nil, util.ErrForbidden
	}

	if updates.Name != nil {
		existing.Name = *updates.Name
	}
	if updates.ColorHex != nil {
		existing.ColorHex = *updates.ColorHex
	}

	err = r.db.QueryRow(`
		UPDATE categories
		SET name = $1, color_hex = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
		RETURNING updated_at
	`, existing.Name, existing.ColorHex, existing.ID).Scan(&existing.UpdatedAt)

	if err != nil {
		return nil, err
	}

	return existing, nil
}

func (r *categoryRepo) Delete(id int64, ownerID int64) error {
	existing, err := r.GetByID(id)
	if err != nil {
		return err
	}

	if existing.OwnerID != ownerID {
		return util.ErrForbidden
	}

	// category_id ON DELETE SET NULL থাকায় linked task গুলো uncategorized হয়ে যাবে, মুছে যাবে না
	_, err = r.db.Exec(`DELETE FROM categories WHERE id = $1`, id)
	return err
}