package util

import (
	"crypto/rand"
	"fmt"
	"math/big"
)

func GenerateOTP() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(1000000))
	return fmt.Sprintf("%06d", n.Int64())
}
