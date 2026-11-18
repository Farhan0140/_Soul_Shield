package user

import (
	"encoding/json"
	"errors"
	"log/slog"
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
// @Failure 429 {object} ErrorResponse
// @Router /users/login [post]
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var reqLogin requestLogin

	decoder := json.NewDecoder(r.Body)
	err := decoder.Decode(&reqLogin)
	if err != nil {
		util.SendError(w, map[string]string{
			"error": "Invalid Request Data",
		}, http.StatusBadRequest)
		return
	}

	if rejectIfRateLimited(w,
		rateLimitCheck{h.limiters.loginByIP, util.ClientIP(r)},
		rateLimitCheck{h.limiters.loginByEmail, normalizedEmail(reqLogin.Email)},
	) {
		return
	}

	usr, err := h.userRepo.Find(reqLogin.Email, reqLogin.Password)
	if err != nil {
		// Unknown email and wrong password get the SAME 401 + message, so login
		// can't be used to probe which emails are registered (and a typo in the
		// email no longer shows up as a 500 "server error").
		if errors.Is(err, util.ErrInvalidCredentials) || errors.Is(err, util.ErrUserNotFound) {
			util.SendError(w, map[string]string{
				"error": util.ErrInvalidCredentials.Error(),
			}, http.StatusUnauthorized)
			return
		}
		slog.Error("login: user lookup failed", "error", err)
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
		ID:           usr.ID,
		Full_Name:    usr.Full_Name,
		Email:        usr.Email,
		Role:         usr.Role,
		TokenVersion: usr.TokenVersion,
	})
	if err != nil {
		util.SendError(w, map[string]string{
			"error": "Internal Server Error",
		}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, access_token, http.StatusOK)
}
