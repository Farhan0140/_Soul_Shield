package user

import (
	"encoding/json"
	"net/http"
	"soulsheld/util"
	"strings"
)

// The user package has no shared getUserID/unauthorized helpers (its JWT-authed
// route, /users/me, parses the header itself) — so define both here.
func getUserID(r *http.Request) (int64, bool) {
	val := r.Context().Value("userID")
	id, ok := val.(int64)
	if !ok {
		return 0, false
	}
	return id, true
}

func unauthorized(w http.ResponseWriter) {
	util.SendError(w, map[string]string{"error": "Unauthorize"}, http.StatusUnauthorized)
}

type PushTokenRequest struct {
	// The Expo push token (ExponentPushToken[...]) obtained on-device via
	// getExpoPushTokenAsync. Unique per device; re-registering updates the
	// row's user/platform.
	Token    string `json:"token" example:"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"`
	Platform string `json:"platform" example:"android"` // ios | android | unknown
}

// RegisterPushToken godoc
//
// @Summary Register push token
// @Description Register (or re-register) this device's Expo push token so the
// @Description API can send "data changed" sync alerts to it when tasks change
// @Description elsewhere (e.g. a web edit). Authenticated.
// @Tags Users
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body PushTokenRequest true "Push token"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Router /users/push-token [post]
func (h *Handler) RegisterPushToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req PushTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		util.SendError(w, map[string]string{"error": "token is required"}, http.StatusBadRequest)
		return
	}
	platform := strings.TrimSpace(req.Platform)
	if platform == "" {
		platform = "unknown"
	}

	if err := h.pushRepo.UpsertToken(userID, token, platform); err != nil {
		util.SendError(w, map[string]string{"error": "Failed to register push token"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, map[string]string{"message": "Push notifications enabled"}, http.StatusOK)
}

// DeletePushToken godoc
//
// @Summary Delete push token
// @Description Remove this device's push token (called when the user turns
// @Description cross-device sync alerts off, or logs out).
// @Tags Users
// @Security BearerAuth
// @Accept json
// @Produce json
// @Param body body PushTokenRequest true "Push token"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Router /users/push-token [delete]
func (h *Handler) DeletePushToken(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		unauthorized(w)
		return
	}

	var req PushTokenRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		util.SendError(w, map[string]string{"error": "Invalid Request Body"}, http.StatusBadRequest)
		return
	}
	token := strings.TrimSpace(req.Token)
	if token == "" {
		util.SendError(w, map[string]string{"error": "token is required"}, http.StatusBadRequest)
		return
	}

	if err := h.pushRepo.DeleteToken(userID, token); err != nil {
		util.SendError(w, map[string]string{"error": "Failed to remove push token"}, http.StatusInternalServerError)
		return
	}

	util.SendData(w, map[string]string{"message": "Push notifications disabled"}, http.StatusOK)
}
