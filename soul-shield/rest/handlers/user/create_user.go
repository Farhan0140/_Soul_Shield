package user

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"soulsheld/repo"
	"soulsheld/util"
	"strings"
)

type User struct {
	ID             int    `json:"id"`
	Full_Name      string `json:"full_name"`
	Email          string `json:"email"`
	Password       string `json:"password"`
	SecurityAnswer string `json:"security_answer"`
}

// CreateUser godoc
//
// @Summary Create user
// @Description Register a new user. Rules: full_name 1-100 characters, a valid email,
// @Description password 6-72 characters, security_answer 3-100 characters.
// @Tags Users
// @Accept json
// @Produce json
// @Param body body RegisterRequest true "User Info"
// @Success 201 {object} RegisterResponse
// @Failure 400 {object} ErrorResponse
// @Failure 409 {object} ErrorResponse
// @Failure 429 {object} ErrorResponse
// @Router /users/register [post]
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var newUser User

	if err := json.NewDecoder(r.Body).Decode(&newUser); err != nil {
		util.SendError(w, map[string]string{
			"error": "Invalid Request Data",
		}, http.StatusBadRequest)
		return
	}

	if rejectIfRateLimited(w, rateLimitCheck{h.limiters.registerByIP, util.ClientIP(r)}) {
		return
	}

	fullName := strings.TrimSpace(newUser.Full_Name)
	securityAnswer := strings.TrimSpace(newUser.SecurityAnswer)
	email := strings.ToLower(strings.TrimSpace(newUser.Email))

	if err := firstError(
		util.ValidateFullName(fullName),
		util.ValidateEmail(email),
		util.ValidateNewPassword(newUser.Password),
	); err != nil {
		util.SendError(w, map[string]string{"error": err.Error()}, http.StatusBadRequest)
		return
	}
	if len(securityAnswer) < 3 || len(securityAnswer) > 100 {
		util.SendError(w, map[string]string{
			"error": "Security answer must be between 3 and 100 characters",
		}, http.StatusBadRequest)
		return
	}

	createdUser, err := h.userRepo.Create(repo.User{
		Full_Name:      fullName,
		Email:          email,
		Password:       newUser.Password,
		SecurityAnswer: securityAnswer,
	})
	if err != nil {
		if errors.Is(err, util.ErrUserExists) {
			// Kept in its historical {success:false,message} shape: both
			// clients read "message" for this case.
			util.SendData(w, map[string]any{
				"success": false,
				"message": "User already exists",
			}, http.StatusConflict)
			return
		}
		slog.Error("register failed", "error", err)
		util.SendError(w, map[string]string{
			"error": "Internal Server Error",
		}, http.StatusInternalServerError)
		return
	}

	// Respond with an explicit DTO, never the repo.User itself, so internal
	// fields (password hash, security-answer state) can't leak to the client.
	util.SendData(
		w,
		RegisterResponse{
			ID:        createdUser.ID,
			Full_Name: createdUser.Full_Name,
			Email:     createdUser.Email,
		},
		http.StatusCreated,
	)
}

// firstError returns the first non-nil error.
func firstError(errs ...error) error {
	for _, err := range errs {
		if err != nil {
			return err
		}
	}
	return nil
}
