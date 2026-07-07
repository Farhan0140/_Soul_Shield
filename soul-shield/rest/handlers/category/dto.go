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
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type SuccessResponse struct {
	Message string `json:"message" example:"Category deleted successfully"`
}