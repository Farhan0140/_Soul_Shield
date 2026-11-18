package repo

import (
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

func TestIsRejectableDataError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want bool
	}{
		{"invalid date (class 22)", &pgconn.PgError{Code: "22007"}, true},
		{"malformed uuid (class 22)", &pgconn.PgError{Code: "22P02"}, true},
		{"check violation (class 23)", &pgconn.PgError{Code: "23514", ConstraintName: "chk_task_type_fields"}, true},
		{"wrapped unique violation", fmt.Errorf("insert: %w", &pgconn.PgError{Code: "23505"}), true},
		{"connection failure (class 08) aborts the batch", &pgconn.PgError{Code: "08006"}, false},
		{"non-postgres error aborts the batch", errors.New("network down"), false},
	}
	for _, c := range cases {
		if got := isRejectableDataError(c.err); got != c.want {
			t.Errorf("%s: isRejectableDataError = %v, want %v", c.name, got, c.want)
		}
	}
}

func TestRejectionDetail(t *testing.T) {
	if got := rejectionDetail(&pgconn.PgError{Code: "23514", ConstraintName: "chk_task_owner"}); got != "chk_task_owner" {
		t.Errorf("constraint error detail = %q", got)
	}
	if got := rejectionDetail(&pgconn.PgError{Code: "22007"}); got != "SQLSTATE 22007" {
		t.Errorf("data exception detail = %q", got)
	}
}

func TestUnregisteredTokens(t *testing.T) {
	tokens := []string{"ExponentPushToken[a]", "ExponentPushToken[b]", "ExponentPushToken[c]"}
	body := []byte(`{"data":[
		{"status":"ok","id":"1"},
		{"status":"error","message":"not registered","details":{"error":"DeviceNotRegistered"}},
		{"status":"error","message":"too big","details":{"error":"MessageTooBig"}}
	]}`)
	dead := unregisteredTokens(tokens, body)
	if len(dead) != 1 || dead[0] != "ExponentPushToken[b]" {
		t.Fatalf("dead = %v, want only token b", dead)
	}
	if got := unregisteredTokens(tokens, []byte("not json")); got != nil {
		t.Fatalf("garbage body: %v", got)
	}
}
