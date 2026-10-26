package user

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"soulsheld/util"
)

type requestLogin struct {
	Email    string `json:"email" db:"email"`
	Password string `json:"password" db:"password"`
}

// Login godoc
//
// @Summary Login User
// @Description Login using email and password
// @Tags Auth
// @Accept json
// @Produce json
// @Param body body LoginRequest true "Login Credentials"
// @Success 200 {object} SuccessResponse
// @Failure 401 {object} ErrorResponse
// @Router /users/login [post]
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var reqLogin requestLogin

	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&reqLogin)
	if err != nil {
		fmt.Println(err)
		util.SendError(w, map[string]string{
			"error": "Invalid Request Data",
		}, http.StatusBadRequest)
		return
	}

	usr, err := h.userRepo.Find(reqLogin.Email, reqLogin.Password)
	if err != nil {
		if errors.Is(err, util.ErrInvalidCredentials) {
			util.SendError(w, map[string]string{
				"error": err.Error(),
			}, http.StatusUnauthorized)
			return
		}
		fmt.Println(err)
		util.SendError(w, map[string]string{
			"error": "Internal Server Error",
		}, http.StatusInternalServerError)
		return
	}
	if usr == nil {
		util.SendError(w, map[string]string{
			"error": "Internal Server Error",
		}, http.StatusInternalServerError)
		return
	}

	access_token, err := util.CreateJWT(h.cnf.SecretKey, util.CustomClaims{
		ID:        usr.ID,
		Full_Name: usr.Full_Name,
		Email:     usr.Email,
		Role:      usr.Role,
	})
	if err != nil {
		util.SendError(w, map[string]string{
			"error": "Internal Server Error",
		}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, access_token, http.StatusOK)
}
