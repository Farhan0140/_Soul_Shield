package sync

import "soulsheld/repo"

// PushRequest/Response mirror repo.SyncChange/SyncChangeResult directly -
// see repo/sync.go and repo/sync_push.go for the full shape and the
// reasoning behind each field (uuid-keyed relationships, per-change
// accepted/superseded/rejected status instead of one aborting error, the
// "increment" op's additive delta for counter tasks, etc.).

type PushRequest struct {
	Changes []repo.SyncChange `json:"changes"`
}

type PushResponse struct {
	Results []repo.SyncChangeResult `json:"results"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}
