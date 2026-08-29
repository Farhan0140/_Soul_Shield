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
	Position  int       `db:"position" json:"position"`
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
	// Reorder - ownerID এর সব category এর position পুনরায় সেট করে, orderedIDs এর index অনুযায়ী।
	// orderedIDs অবশ্যই ownerID এর বর্তমান category id সেটের সাথে হুবহু মিলতে হবে (নাহলে ErrOrderMismatch)।
	Reorder(ownerID int64, orderedIDs []int64) ([]Category, error)
}

type categoryRepo struct {
	db *sqlx.DB
}

func NewCategoryRepo(db *sqlx.DB) CategoryRepo {
	return &categoryRepo{db: db}
}

func (r *categoryRepo) Create(cat Category) (*Category, error) {
	// নতুন category সবসময় owner এর লিস্টের নিচে বসবে (position = max+1) - user
	// পরে drag করে যেকোনো জায়গায় নিতে পারবে।
	var nextPosition int
	if err := r.db.Get(&nextPosition, `
		SELECT COALESCE(MAX(position) + 1, 0) FROM categories WHERE owner_id = $1
	`, cat.OwnerID); err != nil {
		return nil, err
	}
	cat.Position = nextPosition

	query := `
		INSERT INTO categories (name, color_hex, owner_id, position)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`

	err := r.db.QueryRow(query, cat.Name, cat.ColorHex, cat.OwnerID, cat.Position).
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
		SELECT * FROM categories WHERE owner_id = $1 ORDER BY position, id
	`, ownerID)
	return categories, err
}

// Reorder - পুরো ordered id লিস্ট নিয়ে position = index বসায় (sub_tasks.ReplaceForParent
// এর মতোই প্যাটার্ন)। orderedIDs, ownerID এর বর্তমান category id সেটের সাথে হুবহু না মিললে
// (অন্য ডিভাইস থেকে ইতিমধ্যে একটা category delete/create হয়ে থাকলে) ErrOrderMismatch রিটার্ন করে।
func (r *categoryRepo) Reorder(ownerID int64, orderedIDs []int64) ([]Category, error) {
	if len(orderedIDs) == 0 {
		return nil, util.ErrEmptyOrder
	}

	tx, err := r.db.Beginx()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var existingIDs []int64
	if err := tx.Select(&existingIDs, `SELECT id FROM categories WHERE owner_id = $1`, ownerID); err != nil {
		return nil, err
	}

	if !sameIDSet(existingIDs, orderedIDs) {
		return nil, util.ErrOrderMismatch
	}

	for i, id := range orderedIDs {
		if _, err := tx.Exec(`
			UPDATE categories SET position = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2 AND owner_id = $3
		`, i, id, ownerID); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return r.ListByOwner(ownerID)
}

// sameIDSet - দুইটা id slice এ একই id গুলো আছে কিনা (order/duplicate বাদে) চেক করে।
func sameIDSet(a, b []int64) bool {
	if len(a) != len(b) {
		return false
	}
	set := make(map[int64]bool, len(a))
	for _, id := range a {
		set[id] = true
	}
	seen := make(map[int64]bool, len(b))
	for _, id := range b {
		if !set[id] || seen[id] {
			return false
		}
		seen[id] = true
	}
	return true
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