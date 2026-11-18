package user

import "testing"

func TestExpoPushTokenPattern(t *testing.T) {
	good := []string{"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]", "ExpoPushToken[abc_DEF-123]"}
	bad := []string{"", "ExponentPushToken[]", "fcm:abcdef", "ExponentPushToken[a b]", "ExponentPushToken[x]; DROP"}
	for _, tok := range good {
		if !expoPushTokenPattern.MatchString(tok) {
			t.Errorf("rejected valid token %q", tok)
		}
	}
	for _, tok := range bad {
		if expoPushTokenPattern.MatchString(tok) {
			t.Errorf("accepted invalid token %q", tok)
		}
	}
}
