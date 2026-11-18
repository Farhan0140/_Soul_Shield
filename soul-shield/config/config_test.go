package config

import (
	"reflect"
	"strings"
	"testing"
)

func TestParseOrigins(t *testing.T) {
	if got, want := ParseOrigins(""), strings.Split(DefaultCorsOrigins, ","); !reflect.DeepEqual(got, want) {
		t.Fatalf("empty: %v, want defaults %v", got, want)
	}
	got := ParseOrigins(" https://a.example/ , ,http://localhost:5173")
	want := []string{"https://a.example", "http://localhost:5173"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("got %v, want %v", got, want)
	}
}
