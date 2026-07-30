package user

import (
	"encoding/json"
	"errors"
	"fmt"
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
// @Description Register a new user
// @Tags Users
// @Accept json
// @Produce json
// @Param body body RegisterRequest true "User Info"
// @Success 201 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Router /users/register [post]
func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var newUser User

	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&newUser)
	if err != nil {
		fmt.Println(err)
		util.SendError(w, map[string]string{
			"error": "Invalid Request Data",
		}, http.StatusBadRequest)
		return
	}

	securityAnswer := strings.TrimSpace(newUser.SecurityAnswer)
	if len(securityAnswer) < 3 || len(securityAnswer) > 100 {
		util.SendError(w, map[string]string{
			"error": "Security answer must be between 3 and 100 characters",
		}, http.StatusBadRequest)
		return
	}

	createdUser, err := h.userRepo.Create(repo.User{
		Full_Name:      newUser.Full_Name,
		Email:          newUser.Email,
		Password:       newUser.Password,
		SecurityAnswer: securityAnswer,
	})
	if err != nil {

		if errors.Is(err, util.ErrOTPNotFound) {
			util.SendData(
				w,
				map[string]any{
					"success": false,
					"message": "Please verify your email first",
				},
				http.StatusBadRequest,
			)
			return

		} else if errors.Is(err, util.ErrEmailNotVerified) {
			util.SendData(
				w,
				map[string]any{
					"success": false,
					"message": "Email is not verified",
				},
				http.StatusBadRequest,
			)
			return
		} else if errors.Is(err, util.ErrUserExists) {

			util.SendData(
				w,
				map[string]any{
					"success": false,
					"message": "User already exists",
				},
				http.StatusConflict,
			)
			return

		} else {

			util.SendData(
				w,
				map[string]any{
					"success": false,
					"message": err.Error(),
				},
				http.StatusInternalServerError,
			)
			return
		}
	}

	util.SendData(
		w,
		createdUser,
		http.StatusCreated,
	)
}
