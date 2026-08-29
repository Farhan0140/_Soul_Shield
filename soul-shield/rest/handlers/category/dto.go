package category

type CreateCategoryRequest struct {
	Name     string `json:"name" example:"Ibadah"`
	ColorHex string `json:"color_hex" example:"#4F46E5"`
}

type UpdateCategoryRequest struct {
	Name     *string `json:"name,omitempty"`
	ColorHex *string `json:"color_hex,omitempty"`
}

type CategoryResponse struct {
	ID       int64  `json:"id"`
	Name     string `json:"name"`
	ColorHex string `json:"color_hex"`
	Position int    `json:"position"`
}

// ReorderCategoriesRequest - পুরো ordered id লিস্ট (caller এর সব category id, নতুন ক্রমে)
type ReorderCategoriesRequest struct {
	OrderedIDs []int64 `json:"ordered_ids"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type SuccessResponse struct {
	Message string `json:"message" example:"Category deleted successfully"`
}